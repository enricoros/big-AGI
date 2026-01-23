import { default as TurndownService } from 'turndown';


// Cached Turndown service instance
let _turndownService: TurndownService | null = null;

function getTurndownService(): TurndownService {
  if (!_turndownService) {
    _turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
    });

    // Remove script and style elements
    _turndownService.remove(['script', 'style', 'noscript']);
  }
  return _turndownService;
}


/**
 * Convert HTML string to Markdown using Turndown.
 * Performs basic HTML cleaning before conversion.
 */
export function convertHtmlToMarkdown(html: string): string {
  // Basic client-side HTML cleaning using DOMParser
  const cleanedHtml = cleanHtmlForMarkdown(html);
  return getTurndownService().turndown(cleanedHtml);
}


/**
 * Client-side HTML cleaning optimized for Markdown conversion.
 * Uses DOMParser (browser-native) instead of Cheerio (server-only).
 */
function cleanHtmlForMarkdown(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'link', 'noscript', 'iframe', 'svg', 'canvas',
      'nav:not(main nav)', 'aside', 'footer:not(article footer)',
      '.ad', '.ads', '.advertisement', '.banner', '.popup', '.modal', '.overlay',
      '.cookie-banner', '.newsletter-signup', '.social-share', '.comments',
      '.sidebar', '.widget', '.carousel', '.slider',
      '[aria-hidden="true"]', '[hidden]',
      '[data-analytics]', '[data-tracking]', '[data-gtm]',
    ];

    for (const selector of unwantedSelectors) {
      try {
        doc.querySelectorAll(selector).forEach(el => el.remove());
      } catch {
        // Skip invalid selectors (e.g., complex :not() selectors may fail in some browsers)
      }
    }

    // Remove hidden elements via inline styles
    doc.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style') || '';
      if (style.includes('display: none') || style.includes('display:none') ||
          style.includes('visibility: hidden') || style.includes('visibility:hidden'))
        el.remove();
    });

    // Clean up anchor hrefs (remove tracking parameters)
    doc.querySelectorAll('a[href]').forEach(el => {
      const href = el.getAttribute('href');
      if (!href) return;

      // Remove javascript: links
      if (href.toLowerCase().startsWith('javascript:')) {
        el.removeAttribute('href');
        return;
      }

      // Remove tracking parameters
      if (href.includes('?')) {
        try {
          const url = new URL(href, 'http://placeholder');
          const cleanParams = new URLSearchParams();
          url.searchParams.forEach((value, key) => {
            if (!key.match(/^(utm_|fbclid|gclid|msclkid)/i))
              cleanParams.append(key, value);
          });
          const cleanHref = `${url.pathname}${cleanParams.toString() ? '?' + cleanParams.toString() : ''}${url.hash}`;
          el.setAttribute('href', cleanHref);
        } catch {
          // Keep original href if URL parsing fails
        }
      }
    });

    // Remove comments (HTML comment nodes)
    const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
    const comments: Comment[] = [];
    while (walker.nextNode())
      comments.push(walker.currentNode as Comment);
    comments.forEach(comment => comment.remove());

    return doc.body.innerHTML;
  } catch (error) {
    console.error('HTML cleaning error:', error);
    return html; // Return original if cleaning fails
  }
}
