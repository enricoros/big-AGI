import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { BrowserContext, connect, ScreenshotOptions, TimeoutError } from '@cloudflare/puppeteer';

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
  screenshot: z.object({
    width: z.number(),
    height: z.number(),
    quality: z.number().optional(),
  }).optional(),
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
  pages: z.array(fetchPageWorkerOutputSchema),
});


export const browseRouter = createTRPCRouter({

  fetchPages: publicProcedure
    .input(fetchPageInputSchema)
    .output(fetchPagesOutputSchema)
    .mutation(async ({ input: { access, subjects, screenshot } }) => {
      const pages: FetchPageWorkerOutputSchema[] = [];

      for (const subject of subjects) {
        try {
          pages.push(await workerPuppeteer(access, subject.url, screenshot?.width, screenshot?.height, screenshot?.quality));
        } catch (error: any) {
          pages.push({
            url: subject.url,
            content: '',
            error: error?.message || JSON.stringify(error) || 'Unknown fetch error',
            stopReason: 'error',
          });
        }
      }

      return { pages };
    }),

});


type BrowseAccessSchema = z.infer<typeof browseAccessSchema>;
type FetchPageWorkerOutputSchema = z.infer<typeof fetchPageWorkerOutputSchema>;

async function workerPuppeteer(access: BrowseAccessSchema, targetUrl: string, ssWidth: number | undefined, ssHeight: number | undefined, ssQuality: number | undefined): Promise<FetchPageWorkerOutputSchema> {

  // access
  const browserWSEndpoint = (access.wssEndpoint || env.PUPPETEER_WSS_ENDPOINT || '').trim();
  const isLocalBrowser = browserWSEndpoint.startsWith('ws://');
  if (!browserWSEndpoint || (!browserWSEndpoint.startsWith('wss://') && !isLocalBrowser))
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid wss:// endpoint',
    });

  const result: FetchPageWorkerOutputSchema = {
    url: targetUrl,
    content: '',
    error: undefined,
    stopReason: 'error',
    screenshot: undefined,
  };

  // [puppeteer] start the remote session
  const browser = await connect({ browserWSEndpoint });

  // for local testing, open an incognito context, to seaparate cookies
  let incognitoContext: BrowserContext | null = null;
  if (isLocalBrowser)
    incognitoContext = await browser.createIncognitoBrowserContext();
  const page = incognitoContext ? await incognitoContext.newPage() : await browser.newPage();
  page.setDefaultNavigationTimeout(WORKER_TIMEOUT);

  // open url
  try {
    const response = await page.goto(targetUrl);
    const contentType = response?.headers()?.['content-type'];
    const isWebPage = contentType?.startsWith('text/html') || contentType?.startsWith('text/plain') || false;
    if (!isWebPage) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(`Invalid content-type: ${contentType}`);
    } else
      result.stopReason = 'end';
  } catch (error: any) {
    const isTimeout: boolean = error instanceof TimeoutError;
    result.stopReason = isTimeout ? 'timeout' : 'error';
    if (!isTimeout)
      result.error = '[Puppeteer] ' + error?.message || error?.toString() || 'Unknown goto error';
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
    result.error = '[Puppeteer] ' + error?.message || error?.toString() || 'Unknown evaluate error';
  }

  // get a screenshot of the page
  try {
    if (ssWidth && ssHeight) {
      const width = ssWidth;
      const height = ssHeight;
      const scale = Math.round(100 * ssWidth / 1024) / 100;

      await page.setViewport({ width: width / scale, height: height / scale, deviceScaleFactor: scale });

      const imageType: ScreenshotOptions['type'] = 'webp';
      const mimeType = `image/${imageType}`;

      const dataString = await page.screenshot({
        type: imageType,
        encoding: 'base64',
        clip: { x: 0, y: 0, width: width / scale, height: height / scale },
        ...(ssQuality && { quality: ssQuality }),
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

  // close the incognito context
  if (incognitoContext) {
    try {
      await incognitoContext.close();
    } catch (error: any) {
      console.error('workerPuppeteer: incognitoContext.close', error);
    }
  }

  // close the browse (important!)
  if (!isLocalBrowser) {
    try {
      await browser.close();
    } catch (error: any) {
      console.error('workerPuppeteer: browser.close', error);
    }
  }

  return result;
}
