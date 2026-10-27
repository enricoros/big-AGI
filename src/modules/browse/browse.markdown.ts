import { default as TurndownService } from 'turndown';


/**
 * Markdown for an LLM reader, from an already-parsed and cleaned document.
 * Shared by the server Browse (domino documents) and the client HTML converter (DOMParser documents).
 */


// buttons with these labels are page chrome; other buttons can carry content (FAQ questions, accordion titles)
const UI_ACTION_LABEL = /^(add a comment|cancel|close|copied!?|copy|copy code|copy link|copy to clipboard|follow|hide|log in|menu|reply|run|search|share|show more|sign in|subscribe)$/i;


/** Relative URLs resolve against the page, so links and media stay usable out of context; fragments stay. */
export function toAbsoluteUrl(url: string, pageUrl: string | undefined): string {
  if (!pageUrl || url.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(url)) return url;
  try {
    return new URL(url, pageUrl).href;
  } catch {
    return url;
  }
}

/** Not domino's replaceWith(): it can drop the subtree when the replacement is the target's own descendant. */
export function replaceNode(target: Node, nodes: Node[]) {
  const parent = target.parentNode;
  if (!parent) return;
  for (const node of nodes)
    parent.insertBefore(node, target);
  parent.removeChild(target);
}


/**
 * Converts the whole document, or only the body's content. Mutates the document.
 * Prose-only cleanup happens here and not in the HTML cleaners: their HTML keeps the page structure and its actions.
 */
export function documentToMarkdown(doc: Document, scope: 'document' | 'body' = 'document'): string {

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

  // never as text, even when a cleaner missed them
  turndownService.remove(['script', 'style', 'noscript']);

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

  return turndownService.turndown(scope === 'body' ? doc.body.innerHTML : doc.documentElement.outerHTML);
}
