type Block = CodeBlock | HtmlBlock | ImageBlock | TextBlock;
export type CodeBlock = { type: 'code'; blockTitle: string; blockCode: string; complete: boolean; };
export type HtmlBlock = { type: 'html'; html: string; };
export type ImageBlock = { type: 'image'; url: string; };
export type TextBlock = { type: 'text'; content: string; }; // for Text or Markdown


/**
 * TODO: expensive function, especially as it's not been used in incremental fashion
 */
export const parseBlocks = (forceText: boolean, text: string): Block[] => {
  if (forceText)
    return [{ type: 'text', content: text }];

  if (text.startsWith('https://images.prodia.xyz/') && text.endsWith('.png') && text.length > 60)
    return [{ type: 'image', url: text.trim() }];

  // noinspection HtmlRequiredTitleElement
  if (text.startsWith('<!DOCTYPE html') || text.startsWith('<head>\n'))
    return [{ type: 'html', html: text }];

  const codeBlockRegex = /`{3,}([\w\\.+-_]+)?\n([\s\S]*?)(`{3,}|$)/g;
  const result: Block[] = [];

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    result.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    const blockTitle: string = (match[1] || '').trim();
    const blockCode: string = match[2].trim();
    const blockEnd: string = match[3];
    result.push({ type: 'code', blockTitle, blockCode, complete: blockEnd.startsWith('```') });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length)
    result.push({ type: 'text', content: text.slice(lastIndex) });

  return result;
};