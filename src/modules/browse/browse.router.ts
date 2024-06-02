import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { BrowserContext, connect, ScreenshotOptions } from '@cloudflare/puppeteer';
import { default as TurndownService } from 'turndown';
import { load as cheerioLoad } from 'cheerio';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { env } from '~/server/env.mjs';


// change the page load and scrape timeout
const WORKER_TIMEOUT = 10 * 1000; // 10 seconds


// Input schemas

const browseAccessSchema = z.object({
  dialect: z.enum(['browse-wss']),
  wssEndpoint: z.string().trim().optional(),
});
type BrowseAccessSchema = z.infer<typeof browseAccessSchema>;

const pageTransformSchema = z.enum(['html', 'text', 'markdown']);
type PageTransformSchema = z.infer<typeof pageTransformSchema>;

const fetchPageInputSchema = z.object({
  access: browseAccessSchema,
  requests: z.array(z.object({
    url: z.string().url(),
    transforms: z.array(pageTransformSchema),
    screenshot: z.object({
      width: z.number(),
      height: z.number(),
      quality: z.number().optional(),
    }).optional(),
  })),
});


// Output schemas

const fetchPageWorkerOutputSchema = z.object({
  url: z.string(),
  content: z.record(pageTransformSchema, z.string()),
  error: z.string().optional(),
  stopReason: z.enum(['end', 'timeout', 'error']),
  screenshot: z.object({
    webpDataUrl: z.string().startsWith('data:image/webp'),
    mimeType: z.string().startsWith('image/'),
    width: z.number(),
    height: z.number(),
  }).optional(),
});
type FetchPageWorkerOutputSchema = z.infer<typeof fetchPageWorkerOutputSchema>;


const fetchPagesOutputSchema = z.object({
  pages: z.array(fetchPageWorkerOutputSchema),
});


export const browseRouter = createTRPCRouter({

  fetchPages: publicProcedure
    .input(fetchPageInputSchema)
    .output(fetchPagesOutputSchema)
    .mutation(async ({ input: { access, requests } }) => {

      const pagePromises = requests.map(request =>
        workerPuppeteer(access, request.url, request.transforms, request.screenshot));

      const results = await Promise.allSettled(pagePromises);

      const pages: FetchPageWorkerOutputSchema[] = results.map((result, index) =>
        result.status === 'fulfilled'
          ? result.value
          : {
            url: requests[index].url,
            content: {},
            error: result.reason?.message || 'Unknown fetch error',
            stopReason: 'error',
          },
      );

      return { pages };
    }),

});


async function workerPuppeteer(
  access: BrowseAccessSchema,
  targetUrl: string,
  transforms: PageTransformSchema[],
  screenshotOptions?: { width: number, height: number, quality?: number },
): Promise<FetchPageWorkerOutputSchema> {

  const browserWSEndpoint = (access.wssEndpoint || env.PUPPETEER_WSS_ENDPOINT || '').trim();
  const isLocalBrowser = browserWSEndpoint.startsWith('ws://');
  if (!browserWSEndpoint || (!browserWSEndpoint.startsWith('wss://') && !isLocalBrowser))
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid wss:// endpoint',
    });

  const result: FetchPageWorkerOutputSchema = {
    url: targetUrl,
    content: {},
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
    } else {
      result.stopReason = 'end';
    }
  } catch (error: any) {
    // This was "error instanceof TimeoutError;" but threw some type error - trying the below instead
    const isTimeout = error?.message?.includes('Navigation timeout') || false;
    result.stopReason = isTimeout ? 'timeout' : 'error';
    if (!isTimeout) {
      result.error = '[Puppeteer] ' + (error?.message || error?.toString() || 'Unknown goto error');
    }
  }

  // transform the content of the page as text
  try {
    if (result.stopReason !== 'error') {
      for (const transform of transforms) {
        switch (transform) {
          case 'html':
            result.content.html = cleanHtml(await page.content());
            break;
          case 'text':
            result.content.text = await page.evaluate(() => document.body.innerText || document.textContent || '');
            break;
          case 'markdown':
            const html = await page.content();
            const cleanedHtml = cleanHtml(html);
            const turndownService = new TurndownService({ headingStyle: 'atx' });
            result.content.markdown = turndownService.turndown(cleanedHtml);
            break;
        }
      }
      if (!Object.keys(result.content).length)
        result.error = '[Puppeteer] Empty content';
    }
  } catch (error: any) {
    result.error = '[Puppeteer] ' + (error?.message || error?.toString() || 'Unknown content error');
  }

  // get a screenshot of the page
  try {
    if (screenshotOptions?.width && screenshotOptions?.height) {
      const { width, height, quality } = screenshotOptions;
      const scale = Math.round(100 * width / 1024) / 100;

      await page.setViewport({ width: width / scale, height: height / scale, deviceScaleFactor: scale });

      const imageType: ScreenshotOptions['type'] = 'webp';
      const mimeType = `image/${imageType}`;

      const dataString = await page.screenshot({
        type: imageType,
        encoding: 'base64',
        clip: { x: 0, y: 0, width: width / scale, height: height / scale },
        ...(quality && { quality }),
      }) as string;

      result.screenshot = { webpDataUrl: `data:${mimeType};base64,${dataString}`, mimeType, width, height };
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


function cleanHtml(html: string) {
  const $ = cheerioLoad(html);

  // Remove standard unwanted elements
  $('script, style, nav, aside, noscript, iframe, svg, canvas, .ads, .comments, link[rel="stylesheet"]').remove();

  // Remove elements that might be specific to proxy services or injected by them
  $('[id^="brightdata-"], [class^="brightdata-"]').remove();

  // Remove comments
  $('*').contents().filter(function() {
    return this.type === 'comment';
  }).remove();

  // Remove empty elements
  $('p, div, span').each(function() {
    if ($(this).text().trim() === '' && $(this).children().length === 0) {
      $(this).remove();
    }
  });

  // Merge consecutive paragraphs
  $('p + p').each(function() {
    $(this).prev().append(' ' + $(this).text());
    $(this).remove();
  });

  // Return the cleaned HTML
  return $.html();
}