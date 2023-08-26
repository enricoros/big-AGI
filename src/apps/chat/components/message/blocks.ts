type Block = CodeBlock | HtmlBlock | ImageBlock | LatexBlock | TextBlock;
export type CodeBlock = { type: 'code'; blockTitle: string; blockCode: string; complete: boolean; };
export type HtmlBlock = { type: 'html'; html: string; };
export type ImageBlock = { type: 'image'; url: string; };
export type LatexBlock = { type: 'latex'; latex: string; };
export type TextBlock = { type: 'text'; content: string; }; // for Text or Markdown


export function parseBlocks(forceText: boolean, text: string): Block[] {
  if (forceText)
    return [{ type: 'text', content: text }];

  const regexPatterns = {
    codeBlock: /`{3,}([\w\\.+-_]+)?\n([\s\S]*?)(`{3,}\n?|$)/g,
    imageBlock: /(https:\/\/images\.prodia\.xyz\/.*?\.png)/g, // NOTE: only Prodia for now - but this shall be expanded to markdown images ![alt](url) or any png/jpeg
    latexBlock: /\$\$(.*?)\$\$\n?/g,
  };

  const blocks: Block[] = [];
  let lastIndex = 0;

  while (true) {

    // find the first match (if any) trying all the regexes
    let match: RegExpExecArray | null = null;
    let matchType: keyof typeof regexPatterns | null = null;
    for (const type in regexPatterns) {
      const regex = regexPatterns[type as keyof typeof regexPatterns];
      regex.lastIndex = lastIndex;
      const currentMatch = regex.exec(text);
      if (currentMatch && (match === null || currentMatch.index < match.index)) {
        match = currentMatch;
        matchType = type as keyof typeof regexPatterns;
      }
    }
    if (match === null)
      break;

    // anything leftover before the match is text
    if (match.index > lastIndex)
      blocks.push({ type: 'text', content: text.slice(lastIndex, match.index) });

    // add the block
    switch (matchType) {
      case 'codeBlock':
        const blockTitle: string = (match[1] || '').trim();
        const blockCode: string = match[2].trim();
        const blockEnd: string = match[3];
        blocks.push({ type: 'code', blockTitle, blockCode, complete: blockEnd.startsWith('```') });
        break;

      case 'imageBlock':
        const url: string = match[1];
        blocks.push({ type: 'image', url });
        break;

      case 'latexBlock':
        const latex: string = match[1];
        blocks.push({ type: 'latex', latex });
        break;
    }

    // advance the pointer
    lastIndex = match.index + match[0].length;
  }

  // remainder is text
  if (lastIndex < text.length)
    blocks.push({ type: 'text', content: text.slice(lastIndex) });

  return blocks;
}