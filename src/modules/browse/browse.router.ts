import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { connect, Page, ScreenshotOptions, TimeoutError } from '@cloudflare/puppeteer';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { env } from '~/server/env.mjs';


// change the page load and scrape timeout
const WORKER_TIMEOUT = 10 * 1000; // 10 seconds


// Input schemas

const browseAccessSchema = z.object({
  dialect: z.enum(['browse-wss']),
  wssEndpoint: z.string().trim().optional(),
});

const fetchPageInputSchema = z.object({
  access: browseAccessSchema,
  subjects: z.array(z.object({
    url: z.string().url(),
  })),
  screenshotWidth: z.number().optional(),
  screenshotHeight: z.number().optional(),
});


// Output schemas

const fetchPageWorkerOutputSchema = z.object({
  url: z.string(),
  content: z.string(),
  error: z.string().optional(),
  stopReason: z.enum(['end', 'timeout', 'error']),
  screenshot: z.object({
    imageDataUrl: z.string().startsWith('data:image/'),
    mimeType: z.string().startsWith('image/'),
    width: z.number(),
    height: z.number(),
  }).optional(),
});

const fetchPagesOutputSchema = z.object({
  objects: z.array(fetchPageWorkerOutputSchema),
});


export const browseRouter = createTRPCRouter({

  fetchPages: publicProcedure
    .input(fetchPageInputSchema)
    .output(fetchPagesOutputSchema)
    .mutation(async ({ input: { access, subjects, screenshotHeight, screenshotWidth } }) => {
      const results: FetchPageWorkerOutputSchema[] = [];

      for (const subject of subjects) {
        try {
          results.push(await workerPuppeteer(access, subject.url, screenshotWidth, screenshotHeight));
        } catch (error: any) {
          results.push({
            url: subject.url,
            content: '',
            error: error?.message || JSON.stringify(error) || 'Unknown fetch error',
            stopReason: 'error',
          });
        }
      }

      return { objects: results };
    }),

});


type BrowseAccessSchema = z.infer<typeof browseAccessSchema>;
type FetchPageWorkerOutputSchema = z.infer<typeof fetchPageWorkerOutputSchema>;

async function workerPuppeteer(access: BrowseAccessSchema, targetUrl: string, screenshotWidth?: number, screenshotHeight?: number): Promise<FetchPageWorkerOutputSchema> {

  // access
  const browserWSEndpoint = (access.wssEndpoint || env.PUPPETEER_WSS_ENDPOINT || '').trim();
  if (!browserWSEndpoint || !(browserWSEndpoint.startsWith('wss://') || browserWSEndpoint.startsWith('ws://')))
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid wss:// endpoint',
    });

  const result: FetchPageWorkerOutputSchema = {
    url: targetUrl,
    content: '(no content)',
    error: undefined,
    stopReason: 'error',
    screenshot: undefined,
  };

  // [puppeteer] start the remote session
  const browser = await connect({ browserWSEndpoint });

  // for local testing, open an incognito context, to seaparate cookies
  let page: Page;
  if (browserWSEndpoint.startsWith('ws://')) {
    const context = await browser.createIncognitoBrowserContext();
    page = await context.newPage();
  } else {
    page = await browser.newPage();
  }

  // open url
  try {
    page.setDefaultNavigationTimeout(WORKER_TIMEOUT);
    await page.goto(targetUrl);
    result.stopReason = 'end';
  } catch (error: any) {
    const isExpected: boolean = error instanceof TimeoutError;
    result.stopReason = isExpected ? 'timeout' : 'error';
    if (!isExpected) {
      result.error = '[Puppeteer] Loading issue: ' + error?.message || error?.toString() || 'Unknown error';
      console.error('workerPuppeteer: page.goto', error);
    }
  }

  // transform the content of the page as text
  try {
    if (result.stopReason !== 'error') {
      result.content = await page.evaluate(() => {
        const content = document.body.innerText || document.textContent;
        if (!content)
          throw new Error('No content');
        return content;
      });
    }
  } catch (error: any) {
    console.error('workerPuppeteer: page.evaluate', error);
  }

  // get a screenshot of the page
  try {
    if (screenshotWidth && screenshotHeight) {
      const width = screenshotWidth;
      const height = screenshotHeight;
      const scale = 0.5; // 10%

      await page.setViewport({ width: width / scale, height: height / scale, deviceScaleFactor: scale });

      const imageType: ScreenshotOptions['type'] = 'webp';
      const mimeType = `image/${imageType}`;

      const dataString = await page.screenshot({
        type: imageType,
        encoding: 'base64',
        clip: { x: 0, y: 0, width: width / scale, height: height / scale },
        quality: undefined,
      }) as string;

      result.screenshot = { imageDataUrl: `data:${mimeType};base64,${dataString}`, mimeType, width, height };
    }
  } catch (error: any) {
    console.error('workerPuppeteer: page.screenshot', error);
  }

  // close the page
  try {
    await page.close();
  } catch (error: any) {
    console.error('workerPuppeteer: page.close', error);
  }

  // close the browse (important!)
  try {
    await browser.close();
  } catch (error: any) {
    console.error('workerPuppeteer: browser.close', error);
  }

  return result;
}
