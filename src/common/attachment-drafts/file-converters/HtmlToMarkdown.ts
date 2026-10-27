import { documentToMarkdown, toAbsoluteUrl } from '~/modules/browse/browse.markdown';


/**
 * Convert HTML string to Markdown, with the same markdown step as the server Browse.
 * Performs basic HTML cleaning before conversion; relative links resolve against pageUrl when given.
 */
export function convertHtmlToMarkdown(html: string, pageUrl?: string): string {
  // Basic client-side HTML cleaning using DOMParser
  const doc = new DOMParser().parseFromString(html, 'text/html');
  cleanDocumentForMarkdown(doc, pageUrl);
  return documentToMarkdown(doc, 'body');
}


/**
 * Client-side HTML cleaning optimized for Markdown conversion, in place.
 * Uses DOMParser (browser-native) instead of domino (server-side).
 */
function cleanDocumentForMarkdown(doc: Document, pageUrl: string | undefined): void {
  try {

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

    // Media sources resolve against the page
    doc.querySelectorAll('[src]').forEach(el => el.setAttribute('src', toAbsoluteUrl(el.getAttribute('src') || '', pageUrl)));

    // Clean up anchor hrefs (resolve against the page, remove tracking parameters)
    doc.querySelectorAll('a[href]').forEach(el => {
      const href = el.getAttribute('href');
      if (!href) return;

      // Remove javascript: links
      if (href.toLowerCase().startsWith('javascript:')) {
        el.removeAttribute('href');
        return;
      }

      const resolvedHref = toAbsoluteUrl(href, pageUrl);
      el.setAttribute('href', resolvedHref);

      // Remove tracking parameters - absolute links keep their origin, relative links stay relative
      if (resolvedHref.includes('?')) {
        try {
          const base = 'http://placeholder';
          const url = new URL(resolvedHref, base);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
          const cleanParams = new URLSearchParams();
          url.searchParams.forEach((value, key) => {
            if (!key.match(/^(utm_|fbclid|gclid|msclkid)/i))
              cleanParams.append(key, value);
          });
          const cleanHref = `${url.origin === base ? '' : url.origin}${url.pathname}${cleanParams.toString() ? '?' + cleanParams.toString() : ''}${url.hash}`;
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
  } catch (error) {
    console.error('HTML cleaning error:', error); // convert what is there
  }
}
