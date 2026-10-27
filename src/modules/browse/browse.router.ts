import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import puppeteer, { Browser, BrowserContext, ScreenshotOptions } from 'puppeteer-core';
import { default as TurndownService } from 'turndown';
import { createDocument } from '@mixmark-io/domino';

import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env.server';

import { workerPuppeteerDownloadFileOrThrow } from './browse.files';


// configuration
const DISABLE_FILE_DOWNLOADS = true;
const WORKER_TIMEOUT = 20 * 1000; // 20 seconds
const SCREENSHOT_TIMEOUT = 8 * 1000; // 8 seconds - a thumbnail is never worth the full protocol ceiling (WORKER_TIMEOUT + 2s)
const MAX_REQUESTS_PER_CALL = 4; // the client sends 1
const SCREENSHOT_MIN_SIDE = 16;
const SCREENSHOT_MAX_SIDE = 2048;


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
    transforms: z.array(pageTransformSchema).max(pageTransformSchema.options.length),
    allowFileDownloads: z.boolean().optional(),
    screenshot: z.object({
      width: z.number().int().min(SCREENSHOT_MIN_SIDE).max(SCREENSHOT_MAX_SIDE),
      height: z.number().int().min(SCREENSHOT_MIN_SIDE).max(SCREENSHOT_MAX_SIDE),
      quality: z.number().int().min(1).max(100).optional(),
    }).optional(),
  })).min(1).max(MAX_REQUESTS_PER_CALL),
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
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      // show only the host - the endpoint query string may carry credentials
      let endpointHost = '';
      try {
        endpointHost = ` (${new URL(browserWSEndpoint).host})`;
      } catch {
        // unparsable endpoint: omit
      }
      throw new Error(`Browse service unreachable${endpointHost}. The browser endpoint is not accessible.`);
    }
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
            result.content.html = cleanHtml(await page.content(), page.url());
            break;
          case 'text':
            result.content.text = await page.evaluate(() => document.body.innerText || document.textContent || '');
            break;
          case 'markdown':
            const html = await page.content();
            const cleanedHtml = cleanHtml(html, page.url());
            result.content.markdown = htmlToMarkdown(cleanedHtml);
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


const CLEAN_HTML_MAX_CHARS = 5_000_000;

// not domino's replaceWith(): it can drop the subtree when the replacement is the target's own descendant
function replaceNode(target: Node, nodes: Node[]) {
  const parent = target.parentNode;
  if (!parent) return;
  for (const node of nodes)
    parent.insertBefore(node, target);
  parent.removeChild(target);
}

function cleanHtml(html: string, pageUrl?: string): string {
  // bound parse/serialize cost on attacker-controlled pages
  if (html.length > CLEAN_HTML_MAX_CHARS)
    html = html.slice(0, CLEAN_HTML_MAX_CHARS);

  try {
    const doc = createDocument(html);
    const all = (selector: string) => Array.from(doc.querySelectorAll(selector));
    // relative URLs resolve against the page, so links and media stay usable out of context; fragments stay
    const toAbsolute = (url: string) => {
      if (!pageUrl || url.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(url)) return url;
      try {
        return new URL(url, pageUrl).href;
      } catch {
        return url;
      }
    };

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
    all(unwantedSelectors).forEach(el => el.remove());

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
    for (const el of all('*')) {
      const tagName = el.localName.toLowerCase();

      // Get allowed attributes for this tag
      const allowedAttrs = new Set([
        ...(tagSpecificAttrs[tagName] || []),
        ...commonAttrs,
      ]);

      // code blocks keep their language-* class, which names the markdown fence
      const codeLanguage = (tagName === 'pre' || tagName === 'code') ? el.getAttribute('class')?.match(/\b(?:language|lang)-[\w+#-]+/)?.[0] : undefined;

      // -all non-allowed attributes
      for (const attr of el.getAttributeNames())
        if (!allowedAttrs.has(attr.toLowerCase()))
          el.removeAttribute(attr);

      if (codeLanguage)
        el.setAttribute('class', codeLanguage);
      const src = el.getAttribute('src');
      if (src)
        el.setAttribute('src', toAbsolute(src));

      // cleanup href attributes on anchors
      if (tagName === 'a') {
        const href = el.getAttribute('href');
        if (href) {
          // -javascript: links
          if (href.toLowerCase().startsWith('javascript:'))
            el.removeAttribute('href');
          // -tracking parameters
          else if (href.includes('?')) {
            try {
              const url = new URL(toAbsolute(href));
              const cleanParams = new URLSearchParams();
              url.searchParams.forEach((value, key) => {
                // keep only essential query parameters
                if (!key.match(/^(utm_|fbclid|gclid|msclkid)/i))
                  cleanParams.append(key, value);
              });
              const cleanHref = `${url.origin}${url.pathname}${
                cleanParams.toString() ? '?' + cleanParams.toString() : ''
              }${url.hash}`;
              el.setAttribute('href', cleanHref);
            } catch (e) {
              // If URL parsing fails, keep original href
            }
          }
          else
            el.setAttribute('href', toAbsolute(href));
        }
      }
    }

    // 3. --comments
    for (const el of all('*'))
      for (const node of Array.from(el.childNodes))
        if (node.nodeType === node.COMMENT_NODE)
          node.remove();

    // 4. --empty element
    const preserveTags = new Set([
      'img', 'br', 'hr', 'input', 'source', 'meta', 'link',
      'area', 'base', 'col', 'embed', 'param', 'track', 'wbr',
    ]);
    for (const el of all('*')) {
      const tagName = el.localName.toLowerCase();
      const hasContent =
        el.textContent?.trim() ||
        el.querySelector('img, video, audio, iframe, canvas, svg') ||
        preserveTags.has(tagName) ||
        (tagName === 'a' && el.getAttribute('href'));

      if (!hasContent && !el.children.length)
        el.remove();
    }

    // 5. simplify nested structure
    for (const el of all('div > div:only-child, section > section:only-child')) {
      const parent = el.parentElement;
      if (parent?.children.length === 1)
        replaceNode(parent, [el]);
    }

    // 6. div to paragraph conversion
    const blockTags = new Set(['div', 'p', 'section', 'article', 'aside', 'header', 'footer', 'nav']);
    for (const div of all('div')) {
      const hasBlockElements = Array.from(div.children).some(child => blockTags.has(child.localName));
      if (!hasBlockElements && div.textContent?.trim()) {
        // re-parse as markup rather than moving nodes: the parser closes the <p> around block-level content
        const template = doc.createElement('template');
        template.innerHTML = `<p>${div.innerHTML}</p>`;
        replaceNode(div, Array.from(template.content.childNodes));
      }
    }

    // 7. clean up whitespace (text nodes, outside preformatted content)
    for (const el of all('*:not(pre, pre *, textarea)'))
      for (const node of Array.from(el.childNodes))
        if (node.nodeType === node.TEXT_NODE && node.nodeValue)
          node.nodeValue = node.nodeValue.replace(/\s+/g, ' ');
    // line breaks in code become newlines: turndown reads a code block's text, where a <br> leaves no trace
    for (const br of all('pre br'))
      replaceNode(br, [doc.createTextNode('\n')]);

    // 8. format final output: doctype, top-level comments, <html>
    const serialized = Array.from(doc.childNodes, node =>
      node === doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>`
        : node === doc.documentElement ? doc.documentElement.outerHTML
          : node.nodeType === node.COMMENT_NODE ? `<!--${node.nodeValue}-->` : '',
    ).join('');
    // preformatted blocks sit out the whitespace pass behind tag-shaped placeholders, keeping code indentation
    const preformatted: string[] = [];
    return serialized
      .replace(/<(pre|textarea)\b[^>]*>[\s\S]*?<\/\1>/g, block => `<\u0000${preformatted.push(block) - 1}\u0000>`)
      .replace(/>\s+</g, '>\n<')
      .replace(/\n\s+/g, '\n')
      .split('\n').map(line => line.trim()).join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/<\u0000(\d+)\u0000>/g, (_, index: string) => preformatted[Number(index)])
      .trim();

  } catch (error) {
    console.error('HTML cleaning error:', error);
    return html; // Return original if cleaning fails
  }
}

// buttons with these labels are page chrome; other buttons can carry content (FAQ questions, accordion titles)
const UI_ACTION_LABEL = /^(add a comment|cancel|close|copied!?|copy|copy code|copy link|copy to clipboard|follow|hide|log in|menu|reply|run|search|share|show more|sign in|subscribe)$/i;

function htmlToMarkdown(cleanedHtml: string): string {

  // prose-only cleanup, here and not in cleanHtml: the HTML output keeps the page structure and its actions
  const doc = createDocument(cleanedHtml);
  for (const button of Array.from(doc.querySelectorAll('button')))
    if (UI_ACTION_LABEL.test((button.textContent || '').replace(/\s+/g, ' ').trim()))
      button.remove();
  for (const link of Array.from(doc.querySelectorAll('a'))) {
    // -links with nothing to show (icon links whose svg is gone)
    if (!link.textContent?.trim() && !link.querySelector('img, video, audio')) {
      link.remove();
      continue;
    }
    // a link around a single heading becomes a heading around the link
    const heading = link.children.length === 1 && /^h[1-6]$/.test(link.children[0].localName) ? link.children[0] : null;
    if (heading) {
      replaceNode(link, [heading]);
      for (const node of Array.from(heading.childNodes))
        link.appendChild(node);
      heading.appendChild(link);
      continue;
    }
    // block wrappers would split the link text over lines
    for (const block of Array.from(link.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6, header, section, article, figure, figcaption, picture, ul, ol, li')))
      replaceNode(block, [doc.createTextNode(' '), ...Array.from(block.childNodes), doc.createTextNode(' ')]);
  }

  const turndownService = new TurndownService({ headingStyle: 'atx' });

  // every <pre> is a fenced code block, verbatim - turndown's own rule needs <pre><code> and indents instead
  turndownService.addRule('preformatted', {
    filter: 'pre',
    replacement: (_content, node) => {
      const code = (node.textContent || '').replace(/\n+$/, '');
      const classes = `${node.getAttribute('class') || ''} ${node.querySelector('code')?.getAttribute('class') || ''}`;
      const language = /(?:language|lang)-([\w+#-]+)/.exec(classes)?.[1] || '';
      const fence = code.includes('```') ? '~~~' : '```';
      return `\n\n${fence}${language}\n${code}\n${fence}\n\n`;
    },
  });

  return turndownService.turndown(doc.documentElement.outerHTML);
}