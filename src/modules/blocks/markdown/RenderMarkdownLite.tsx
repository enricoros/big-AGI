import * as React from 'react';


/**
 * Lighter stand-in for the markdown parse, rendered by RenderMarkdown (`lite`) while a block is in flux and its zone is
 * decayed (see RenderDecayZone): the raw text laid out the way markdown would, without a parse. Blank lines split
 * paragraphs, single newlines inside a paragraph are soft breaks (the browser collapses them, exactly as in the rendered
 * <p>), and only lines that open a block keep their own line, markers showing. The completed message renders as full
 * markdown again.
 */

// lines that open a block: heading, list item, quote, table row, fence, math, thematic break, setext underline, indented code
const MD_BLOCK_LINE_REGEX = /^(?: {0,3}(?:#{1,6}\s|[-*+]\s|\d{1,9}[.)]\s|>|\||`{3}|~{3}|\$\$|[-*_](?:\s*[-*_]){2,}\s*$|={3,}\s*$)| {4}|\t)/;

const _lineStyle: React.CSSProperties = { whiteSpace: 'pre-wrap' };

/**
 * Incremental: while streaming the content only grows, so only the line in progress can still change what it is
 * ('-' -> '- x') and the scan resumes from it. Closed blocks keep their element objects (React bails out of them by
 * identity); only the trailing open paragraph and the line in progress are rebuilt.
 */
class LiteMarkdownScanner {
  private content = '';
  private lineStart = 0; // start of the line in progress (not terminated yet)
  private openStart = -1; // start of the trailing paragraph still accepting lines (-1: none), whose lines end at lineStart
  private closed: React.ReactElement[] = [];

  render(content: string): React.ReactElement[] {
    // invalidate the incremental parsing if the content is not contained
    if (!content.startsWith(this.content)) {
      this.lineStart = 0;
      this.openStart = -1;
      this.closed = [];
    }
    this.content = content;

    // scan the lines terminated since the last one
    let pos = this.lineStart;
    for (let nl = content.indexOf('\n', pos); nl >= 0; nl = content.indexOf('\n', pos)) {
      this._scanLine(pos, nl);
      pos = nl + 1;
    }
    this.lineStart = pos;

    // the line in progress is tentative: rebuilt every time, never committed
    const last = content.slice(pos);
    const lastIsText = !!last.trim();
    const elements = [...this.closed];
    if (this.openStart >= 0) {
      const continues = lastIsText && !MD_BLOCK_LINE_REGEX.test(last);
      elements.push(_blockElement(true, this.openStart, content.slice(this.openStart, continues ? content.length : pos - 1)));
      if (lastIsText && !continues)
        elements.push(_blockElement(false, pos, last));
    } else if (lastIsText)
      elements.push(_blockElement(!MD_BLOCK_LINE_REGEX.test(last), pos, last));
    return elements;
  }

  private _scanLine(start: number, end: number) {
    const line = this.content.slice(start, end);
    if (!line.trim())
      this._closeParagraph(start - 1);
    else if (MD_BLOCK_LINE_REGEX.test(line)) {
      this._closeParagraph(start - 1);
      this.closed.push(_blockElement(false, start, line));
    } else if (this.openStart < 0)
      this.openStart = start;
  }

  private _closeParagraph(end: number) {
    if (this.openStart < 0) return;
    this.closed.push(_blockElement(true, this.openStart, this.content.slice(this.openStart, end)));
    this.openStart = -1;
  }
}

function _blockElement(paragraph: boolean, key: number, text: string) {
  return paragraph ? <p key={key}>{text}</p> : <div key={key} style={_lineStyle}>{text}</div>;
}


export function RenderMarkdownLite(props: { content: string }) {

  // one scanner per mounted block: it keeps the closed blocks between renders, so each update scans only the new lines
  const scannerRef = React.useRef<LiteMarkdownScanner | undefined>(undefined);
  if (!scannerRef.current) scannerRef.current = new LiteMarkdownScanner();

  return (
    <div className='markdown-body markdown-lite' /* same depth as CustomMarkdownRenderer, so the CSS rules match */>
      {scannerRef.current.render(props.content)}
    </div>
  );
}
