import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import puppeteer, { Browser, BrowserContext, ScreenshotOptions } from 'puppeteer-core';
import { default as TurndownService } from 'turndown';
import { load as cheerioLoad } from 'cheerio';

import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env';

import { workerPuppeteerDownloadFileOrThrow } from './browse.files';


// configuration
const DISABLE_FILE_DOWNLOADS = true;
const WORKER_TIMEOUT = 20 * 1000; // 20 seconds


// Input schemas

const pageTransformSchema = z.enum(['html', 'text', 'markdown']);

type PageTransformSchema = z.infer<typeof pageTransformSchema>;

const fetchPageInputSchema = z.object({
  access: z.object({
    dialect: z.enum(['browse-wss']),
    wssEndpoint: z.string().trim().optional(),
  }),
  requests: z.array(z.object({
    url: z.url(),
    transforms: z.array(pageTransformSchema),
    allowFileDownloads: z.boolean().optional(),
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
  title: z.string(),

  content: z.partialRecord(pageTransformSchema, z.string()).optional(), // either...
  file: z.object({ // ...or
    mimeType: z.string(),
    encoding: z.literal('base64'),
    data: z.string(),
    size: z.number(),
    fileName: z.string().optional(),
  }).optional(), // ...or

  error: z.string().optional(),
  stopReason: z.enum(['end', 'timeout', 'error']),
  screenshot: z.object({
    imgDataUrl: z.string().startsWith('data:image/webp'),
    mimeType: z.string().startsWith('image/'),
    width: z.number(),
    height: z.number(),
  }).optional(),
});
export type FetchPageWorkerOutputSchema = z.infer<typeof fetchPageWorkerOutputSchema>;


export const browseRouter = createTRPCRouter({

  fetchPagesStreaming: publicProcedure
    .input(fetchPageInputSchema)
    .mutation(async function* ({ input: { access, requests } }) {

      // get endpoint
      const endpoint = (access.wssEndpoint || env.PUPPETEER_WSS_ENDPOINT || '').trim();
      if (!endpoint || (!endpoint.startsWith('wss://') && !endpoint.startsWith('ws://')))
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Invalid WSS browser endpoint' });
      const workerHost = new URL(endpoint).host;

      yield { type: 'ack-start' as const };

      // start all requests in parallel, intercepting errors too
      const results = await Promise.allSettled(requests.map(request =>
        workerPuppeteer(endpoint, request.url, request.transforms, request.allowFileDownloads || false, request.screenshot),
      ));

      // return all pages trapping errors
      const pages: FetchPageWorkerOutputSchema[] = results.map((result, index) => {
        switch (result.status) {
          case 'fulfilled':
            return result.value;
          case 'rejected':
            // server-side log the exception
            console.warn('[DEV] browse.worker: fetchPagesStreaming error:', result.reason);
            return {
              url: requests[index].url,
              title: '',
              content: undefined,
              file: undefined,
              error: typeof result.reason === 'string' ? result.reason
                : result.reason instanceof Error ? result.reason.message
                  : result.reason ? JSON.stringify(result.reason)
                    : 'Unknown fetch error',
              stopReason: 'error',
              screenshot: undefined,
            } satisfies FetchPageWorkerOutputSchema;
        }
      });

      // final result
      yield {
        type: 'result' as const,
        pages,
        workerHost,
      };
    }),

});


async function workerPuppeteer(
  browserWSEndpoint: string,
  targetUrl: string,
  transforms: PageTransformSchema[],
  allowFileDownloads: boolean,
  screenshotOptions?: { width: number, height: number, quality?: number },
): Promise<FetchPageWorkerOutputSchema> {

  // FIXME: remove this line for authenticated users(!)
  if (DISABLE_FILE_DOWNLOADS)
    allowFileDownloads = false;

  const result: FetchPageWorkerOutputSchema = {
    url: targetUrl,
    title: '',
    content: undefined,
    file: undefined,
    error: undefined,
    stopReason: 'error',
    screenshot: undefined,
  };

  // [puppeteer] start the remote session
  const browser: Browser = await puppeteer.connect({
    browserWSEndpoint,
    // Add default options for better stability
    // defaultViewport: { width: 1024, height: 768 },
    // acceptInsecureCerts: true,
    protocolTimeout: WORKER_TIMEOUT,
  });

  // for local testing, open an incognito context, to separate cookies
  let incognitoContext: BrowserContext | null = null;
  const isLocalBrowser = browserWSEndpoint.startsWith('ws://');
  if (isLocalBrowser)
    incognitoContext = await browser.createBrowserContext();
  const page = incognitoContext ? await incognitoContext.newPage() : await browser.newPage();
  page.setDefaultNavigationTimeout(WORKER_TIMEOUT);

  // open url
  try {
    const response = await page.goto(targetUrl, {
      waitUntil: 'networkidle0', // Wait until network is idle
      timeout: WORKER_TIMEOUT,
    });
    if (!response) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('No response received');
    }

    // check if the response is a file or a web page
    const contentType = response.headers()['content-type'];
    const isWebPage = contentType?.startsWith('text/html') || contentType?.startsWith('text/plain') || false;
    if (!isWebPage) {
      if (!allowFileDownloads) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error(`Not a webpage: ${contentType}`);
      } else {
        try {
          const { file } = await workerPuppeteerDownloadFileOrThrow(response);
          result.file = {
            mimeType: file.mimeType,
            encoding: 'base64',
            data: file.data,
            size: file.size,
            fileName: file.filename || '',
          };
          result.stopReason = 'end';
          result.title = file.filename || '';
        } catch (error: any) {
          // noinspection ExceptionCaughtLocallyJS
          throw new Error(error?.message || 'File download failed');
        }
      }
    } else {
      result.stopReason = 'end';
    }
  } catch (error: any) {
    // This was "error instanceof TimeoutError;" but threw some type error - trying the below instead
    const isTimeout = error?.message?.includes('Navigation timeout') || false;
    result.stopReason = isTimeout ? 'timeout' : 'error';
    if (!isTimeout) {
      result.error = '[Puppeteer] ' + (error?.message || error?.toString() || 'Unknown navigation error');
    }
  }

  // Get the page title after successful navigation
  if (result.stopReason !== 'error' && !result.file) {
    try {
      result.title = await page.title();
    } catch (error: any) {
      // result.error = '[Puppeteer] ' + (error?.message || error?.toString() || 'Unknown title error');
    }
  }

  // transform the content of the page as text
  try {
    if (result.stopReason !== 'error' && !result.file) {
      result.content = {};
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
    if (screenshotOptions?.width && screenshotOptions?.height && !result.file) {
      const { width, height, quality } = screenshotOptions;
      const scale = Math.round(100 * width / 1024) / 100;

      await page.setViewport({
        width: width / scale,
        height: height / scale,
        deviceScaleFactor: scale,
      });

      const imageType: ScreenshotOptions['type'] = 'webp';
      const mimeType = `image/${imageType}`;

      const dataString = await page.screenshot({
        type: imageType,
        encoding: 'base64',
        clip: { x: 0, y: 0, width: width / scale, height: height / scale },
        ...(quality && { quality }),
      }) as string;

      result.screenshot = {
        imgDataUrl: `data:${mimeType};base64,${dataString}`,
        mimeType,
        width,
        height,
      };
    }
  } catch (error: any) {
    console.error('workerPuppeteer: page.screenshot', error);
  }

  // Cleanup: close everything in reverse order
  await page.close().catch((error) =>
    console.error('workerPuppeteer: page.close error', { error }));

  if (incognitoContext) await incognitoContext.close().catch((error) =>
    console.error('workerPuppeteer: context.close error', { error }));

  if (!isLocalBrowser) await browser.disconnect().catch((error) =>
    console.error('workerPuppeteer: browser.disconnect error', { error }));
  else await browser.close().catch((error) =>
    console.error('workerPuppeteer: browser.close error', { error }));

  return result;
}


function cleanHtml(html: string): string {
  try {
    const _C = cheerioLoad(html);

    // 1. --unwanted elements
    const unwantedSelectors = [
      // core unwanted
      'script', 'style', 'link', 'noscript', 'iframe', 'svg', 'canvas',

      // navigation and structural elements
      'nav:not(main nav)', 'aside', 'footer:not(article footer)',

      // common web clutter
      '.ad, .ads, .advertisement, .banner, .popup, .modal, .overlay',
      '.cookie-banner, .newsletter-signup, .social-share, .comments',
      '.sidebar, .widget, .carousel, .slider',

      // hidden elements
      '[aria-hidden="true"]',
      '[hidden]',
      '[style*="display: none"]',
      '[style*="visibility: hidden"]',

      // tracking and analytics
      '[data-analytics]',
      '[data-tracking]',
      '[data-gtm]',

      // meta elements except essential ones
      'meta:not([charset], [name="viewport"], [name="description"])',
    ].join(', ');
    _C(unwantedSelectors).remove();

    // 2. --unwanted attributes tag-specific
    const tagSpecificAttrs: Record<string, string[]> = {
      a: ['href', 'title', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      video: ['src', 'controls', 'width', 'height'],
      audio: ['src', 'controls'],
      source: ['src', 'type'],
      meta: ['charset', 'name', 'content', 'viewport'],
      time: ['datetime'],
      input: ['type', 'name', 'value', 'checked', 'disabled'],
      button: ['type', 'disabled'],
      th: ['scope', 'colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      table: ['summary'],
      figure: ['role'],
      figcaption: [],
    };
    const commonAttrs = ['id', 'lang'];
    _C('*').each(function() {
      const el = _C(this);
      if (!('tagName' in this)) return;
      const tagName = this.tagName?.toLowerCase() || '';

      // Get allowed attributes for this tag
      const allowedAttrs = new Set([
        ...(tagSpecificAttrs[tagName] || []),
        ...commonAttrs,
      ]);

      // -all non-allowed attributes
      const attribs = Object.keys(this.attribs || {});
      attribs.forEach(attr => {
        if (!allowedAttrs.has(attr.toLowerCase()))
          el.removeAttr(attr);
      });

      // cleanup href attributes on anchors
      if (tagName === 'a') {
        const href = el.attr('href');
        if (href) {
          // -javascript: links
          if (href.toLowerCase().startsWith('javascript:'))
            el.removeAttr('href');
          // -tracking parameters
          else if (href.includes('?')) {
            try {
              const url = new URL(href);
              const cleanParams = new URLSearchParams();
              url.searchParams.forEach((value, key) => {
                // keep only essential query parameters
                if (!key.match(/^(utm_|fbclid|gclid|msclkid)/i))
                  cleanParams.append(key, value);
              });
              const cleanHref = `${url.origin}${url.pathname}${
                cleanParams.toString() ? '?' + cleanParams.toString() : ''
              }${url.hash}`;
              el.attr('href', cleanHref);
            } catch (e) {
              // If URL parsing fails, keep original href
            }
          }
        }
      }
    });

    // 3. --comments
    _C('*').contents().filter(function() {
      return this.type === 'comment';
    }).remove();

    // 4. --empty element
    const preserveTags = new Set([
      'img', 'br', 'hr', 'input', 'source', 'meta', 'link',
      'area', 'base', 'col', 'embed', 'param', 'track', 'wbr',
    ]);
    _C('*').each(function() {
      const $el = _C(this);
      if (!('tagName' in this)) return;
      const tagName = this.tagName?.toLowerCase() || '';
      const hasContent =
        $el.text().trim() ||
        $el.find('img, video, audio, iframe, canvas, svg').length ||
        preserveTags.has(tagName) ||
        (tagName === 'a' && $el.attr('href'));

      if (!hasContent && !$el.children().length)
        $el.remove();
    });

    // 5. simplify nested structure
    _C('div > div:only-child, section > section:only-child').each(function() {
      const $parent = _C(this).parent();
      if ($parent.children().length === 1)
        $parent.replaceWith(_C(this));
    });

    // 6. div to paragraph conversion
    _C('div').each(function() {
      const $div = _C(this);
      const hasBlockElements = $div.children('div, p, section, article, aside, header, footer, nav').length > 0;
      if (!hasBlockElements && $div.text().trim())
        $div.replaceWith(`<p>${$div.html()}</p>`);
    });

    // 7. clean up whitespace
    _C('*').each(function() {
      if (this.type === 'text') {
        const text = _C(this).text().trim().replace(/\s+/g, ' ');
        if (text) _C(this).text(text);
      }
    });

    // 8. format final output
    return _C.html()
      .replace(/>\s+</g, '>\n<')
      .replace(/\n\s+/g, '\n')
      .replace(/^\s+|\s+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  } catch (error) {
    console.error('HTML cleaning error:', error);
    return html; // Return original if cleaning fails
  }
}