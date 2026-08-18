import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import puppeteer, { Browser, BrowserContext, ScreenshotOptions } from 'puppeteer-core';
import { default as TurndownService } from 'turndown';
import { load as cheerioLoad } from 'cheerio';

import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env.server';

import { workerPuppeteerDownloadFileOrThrow } from './browse.files';


// configuration
const DISABLE_FILE_DOWNLOADS = true;
const WORKER_TIMEOUT = 20 * 1000; // 20 seconds
const SCREENSHOT_TIMEOUT = 8 * 1000; // 8 seconds - a thumbnail is never worth the full protocol ceiling (WORKER_TIMEOUT + 2s)


// Input schemas

const pageTransformSchema = z.enum(['html', 'text', 'markdown']);

type PageTransformSchema = z.infer<typeof pageTransformSchema>;

const fetchPageInputSchema = z.object({
  access: z.object({
    dialect: z.enum(['browse-wss', 'browse-jina']),
    wssEndpoint: z.string().trim().optional(),
    jinaApiKey: z.string().trim().optional(),
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

      // Jina Reader dialect: plain HTTP fetch via r.jina.ai, no browser required
      if (access.dialect === 'browse-jina') {
        const jinaApiKey = (access.jinaApiKey || env.JINA_API_KEY || '').trim();
        // NOTE: r.jina.ai also works keyless at a low rate limit, so an empty key is allowed

        yield { type: 'ack-start' as const };

        const results = await Promise.allSettled(requests.map(request =>
          workerJina(request.url, request.transforms, jinaApiKey),
        ));

        const pages: FetchPageWorkerOutputSchema[] = results.map((result, index) =>
          result.status === 'fulfilled' ? result.value : {
            url: requests[index].url,
            title: '',
            content: undefined,
            file: undefined,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason || 'Unknown fetch error'),
            stopReason: 'error' as const,
            screenshot: undefined,
          });

        yield {
          type: 'result' as const,
          pages,
          workerHost: 'r.jina.ai',
        };
        return;
      }

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
  let browser: Browser;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint,
      // Add default options for better stability
      // defaultViewport: { width: 1024, height: 768 },
      // acceptInsecureCerts: true,
      protocolTimeout: WORKER_TIMEOUT + 2000, // 2s extra for taking the screenshot?
    });
  } catch (connectError: any) {
    // Transform connection errors into user-friendly messages
    const errorMessage = connectError?.message || '';
    if (errorMessage.includes('403'))
      throw new Error('Browse service authentication failed (403). Please check your browser endpoint credentials.');
    if (errorMessage.includes('401'))
      throw new Error('Browse service unauthorized (401). Invalid credentials for the browser endpoint.');
    if (errorMessage.includes('429'))
      throw new Error('Browse service rate limited (429). Too many requests, please try again later.');
    if (errorMessage.includes('502') || errorMessage.includes('503') || errorMessage.includes('504'))
      throw new Error('Browse service temporarily unavailable. Please try again later.');
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND'))
      throw new Error('Browse service unreachable. The browser endpoint is not accessible.');
    // Re-throw with a cleaner message for other connection errors
    throw new Error(`Browse service connection failed: ${errorMessage || 'Unknown error'}`);
  }

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

  /**
   * Get a screenshot of the page - fully best-effort: the page content is already extracted and
   * returned either way, so a failure here is a recovered condition (warn, never error).
   * The thumbnail gets its OWN budget instead of inheriting the 22s protocol ceiling, and the
   * losing promise is always caught - a late ProtocolError must never surface as an unhandled rejection.
   */
  if (screenshotOptions?.width && screenshotOptions?.height && !result.file) {
    const { width, height, quality } = screenshotOptions;
    const scale = Math.round(100 * width / 1024) / 100;
    const imageType: ScreenshotOptions['type'] = 'webp';
    const mimeType = `image/${imageType}`;

    let budgetTimer: ReturnType<typeof setTimeout> | undefined = undefined;
    let budgetExpired = false;

    const dataString = await Promise.race([

      // capture (viewport included: setViewport forces the relayout that makes captureScreenshot slow)
      (async () => {
        await page.setViewport({
          width: width / scale,
          height: height / scale,
          deviceScaleFactor: scale,
        });
        return await page.screenshot({
          type: imageType,
          encoding: 'base64',
          clip: { x: 0, y: 0, width: width / scale, height: height / scale },
          ...(quality && { quality }),
        }) as string;
      })().catch((error: any) => {
        if (!budgetExpired) console.warn(`workerPuppeteer: screenshot skipped - ${_shortError(error)}`);
        return null;
      }),

      // budget
      new Promise<null>(resolve => {
        budgetTimer = setTimeout(() => {
          budgetExpired = true;
          console.warn(`workerPuppeteer: screenshot skipped - over the ${SCREENSHOT_TIMEOUT}ms budget`);
          resolve(null);
        }, SCREENSHOT_TIMEOUT);
      }),

    ]);
    clearTimeout(budgetTimer);

    if (dataString)
      result.screenshot = {
        imgDataUrl: `data:${mimeType};base64,${dataString}`,
        mimeType,
        width,
        height,
      };
  }

  // Cleanup: close everything in reverse order - pure best-effort (the result is already complete)
  await page.close().catch((error) =>
    console.warn(`workerPuppeteer: page.close failed - ${_shortError(error)}`));

  if (incognitoContext) await incognitoContext.close().catch((error) =>
    console.warn(`workerPuppeteer: context.close failed - ${_shortError(error)}`));

  if (!isLocalBrowser) await browser.disconnect().catch((error) =>
    console.warn(`workerPuppeteer: browser.disconnect failed - ${_shortError(error)}`));
  else await browser.close().catch((error) =>
    console.warn(`workerPuppeteer: browser.close failed - ${_shortError(error)}`));

  return result;
}


/** One line, no stack: these are recovered conditions and must not read as runtime errors. */
function _shortError(error: any): string {
  const name = error?.name || 'Error';
  const message = (error?.message || '').split('\n')[0].trim();
  return message ? `${name}: ${message}` : name;
}


// configuration
const JINA_WORKER_TIMEOUT = 45 * 1000; // 45 seconds - Jina Reader can be slow on heavy pages

/**
 * Fetches a page via the Jina Reader API (https://r.jina.ai/<url>).
 * Returns clean LLM-ready markdown - no browser required. No screenshots, no file downloads.
 */
async function workerJina(
  targetUrl: string,
  transforms: PageTransformSchema[],
  apiKey: string,
): Promise<FetchPageWorkerOutputSchema> {

  const result: FetchPageWorkerOutputSchema = {
    url: targetUrl,
    title: '',
    content: undefined,
    file: undefined,
    error: undefined,
    stopReason: 'error',
    screenshot: undefined,
  };

  // Jina Reader does not produce HTML - if that's all the caller wants, bail early
  const wantsMarkdown = transforms.includes('markdown');
  const wantsText = transforms.includes('text');
  if (!wantsMarkdown && !wantsText) {
    result.error = '[Jina] Reader provides markdown/text only (no raw HTML, no screenshots)';
    return result;
  }

  let response: Response;
  try {
    response = await fetch(`https://r.jina.ai/${targetUrl}`, {
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'markdown',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(JINA_WORKER_TIMEOUT),
    });
  } catch (error: any) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    result.stopReason = isTimeout ? 'timeout' : 'error';
    result.error = '[Jina] ' + (isTimeout ? 'Request timed out' : (error?.message || 'Connection error'));
    return result;
  }

  // parse the JSON envelope: { code, status, data: { title, url, content, ... } }
  let envelope: any;
  try {
    envelope = await response.json();
  } catch {
    result.error = `[Jina] Invalid response (HTTP ${response.status})`;
    return result;
  }

  if (!response.ok || !envelope?.data) {
    const message = envelope?.readableMessage || envelope?.message || `HTTP ${response.status}`;
    result.error = `[Jina] ${message}`;
    if (response.status === 401 || envelope?.code === 401)
      result.error = '[Jina] Authentication failed - check your Jina API key';
    if (response.status === 429 || envelope?.code === 429)
      result.error = '[Jina] Rate limited - add a Jina API key or try again later';
    return result;
  }

  const markdown = typeof envelope.data.content === 'string' ? envelope.data.content : '';
  if (!markdown.trim()) {
    result.error = '[Jina] Empty content';
    return result;
  }

  result.title = typeof envelope.data.title === 'string' ? envelope.data.title : '';
  result.content = {};
  if (wantsMarkdown)
    result.content.markdown = markdown;
  if (wantsText)
    result.content.text = markdown; // markdown doubles as readable text
  result.stopReason = 'end';
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