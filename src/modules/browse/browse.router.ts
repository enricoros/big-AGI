import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { connect, Page, TimeoutError } from '@cloudflare/puppeteer';

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
});


// Output schemas

const fetchPageWorkerOutputSchema = z.object({
  url: z.string(),
  content: z.string(),
  error: z.string().optional(),
  stopReason: z.enum(['end', 'timeout', 'error']),
  screenshot: z.object({
    base64: z.string(),
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
    .mutation(async ({ input: { access, subjects } }) => {
      const pages: FetchPageWorkerOutputSchema[] = [];

      for (const subject of subjects) {
        try {
          pages.push(await workerPuppeteer(access, subject.url));
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

async function workerPuppeteer(access: BrowseAccessSchema, targetUrl: string): Promise<FetchPageWorkerOutputSchema> {

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
  let page: Page;
  if (isLocalBrowser) {
    const incognitoContext = await browser.createIncognitoBrowserContext();
    page = await incognitoContext.newPage();
  } else {
    page = await browser.newPage();
  }
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
    const width = 100;
    const height = 100;
    const scale = 0.1; // 10%

    await page.setViewport({ width: width / scale, height: height / scale, deviceScaleFactor: scale });

    result.screenshot = {
      base64: await page.screenshot({
        type: 'webp',
        clip: { x: 0, y: 0, width: width / scale, height: height / scale },
        encoding: 'base64',
      }) as string,
      width,
      height,
    };
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
  if (!isLocalBrowser) {
    try {
      await browser.close();
    } catch (error: any) {
      console.error('workerPuppeteer: browser.close', error);
    }
  }

  return result;
}
