/// <reference types="node" />

// Fenced code pre-pass: a corpus of inputs run through the real `parseBlocksFromText`.
// Four checks, one line of output each when green; a failure lists the rows that are off.
// Run: `NODE_ENV=development npx tsx --test src/modules/blocks/blocks.textparser.test.ts`
//
// One row per behavior the parser must keep. `origin` says where the row comes from: an issue, the
// regex change or revert that introduced it, or the CommonMark section. Newer tickets and comments
// supersede older ones. Rows with `open` are known gaps: the test asserts they still fail, so the fix
// that closes one is told to promote the row. Flipping any row is a decision, made in the same commit
// as the parser change.
//
// Expectations describe the pre-pass, not the final rendering: markdown is the exact slice between
// blocks, code keeps the fence indentation (the pre-pass never strips it), and a fence without a
// close is a partial block (the text is still streaming). The indentation or list marker on the
// fence's own line belongs to neither side: `normalizeFenceBlocks` drops it before comparing, so the
// rows do not depend on whether the block span starts at the backticks or at the line start.

import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { describe, it } from 'node:test';

import type { RenderBlockInputs } from './blocks.types';
import { parseBlocksFromText } from './blocks.textparser';


type FenceExpectBlock =
  | { md: string }
  | { code: string; title?: string; partial?: true };

interface FenceCase {
  name: string;
  origin: string;
  input: string;
  expect: FenceExpectBlock[];
  /** Known gap, in one line. The test asserts the row still fails; remove `open` once it passes. */
  open?: string;
  /** Time bound for large inputs. These rows skip the streaming prefix scan. */
  maxMs?: number;
}

/** Strips the fence-line prefix (indent, optional list marker) from markdown that precedes a code block, dropping it when empty. */
function normalizeFenceBlocks(blocks: FenceExpectBlock[]): FenceExpectBlock[] {
  const out: FenceExpectBlock[] = [];
  blocks.forEach((b, i) => {
    const next = blocks[i + 1];
    if ('md' in b && next && 'code' in next) {
      const md = b.md.replace(/(?<=^|\n)[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?$/, '');
      if (md) out.push({ md });
      return;
    }
    out.push(b);
  });
  return out;
}


// #983, verbatim structure of the Opus 4.6 output in the report
const s983Head = '**Content block structure:** Images are embedded as content blocks within a message\'s `content` array. The structure is:\n\n';
const s983Json = '{\n  "type": "image_url",\n  "image_url": {\n    "url": "data:image/png;base64,<BASE64_DATA>",\n    "detail": "high"\n  }\n}\n';
const s983Tail = '```The base64 image data is passed via a data URL format: `"data:image/jpeg;base64,<your_image_data>"`.\n';

// #752 shapes: whitespace runs are the known backtracking trap
const padLines = (' '.repeat(60) + 'x\n').repeat(3300);
const padRun = ' '.repeat(100_000) + 'x\n';


const FENCE_CASES: FenceCase[] = [

  // --- #1280 (Slava-256, 2026-11): a fence inside prose is prose ---

  {
    name: '#1280: inline fence followed by a line',
    origin: '#1280; CommonMark 4.5: a fence is preceded only by indentation',
    input: 'Test1 ``` Test2\nTest3',
    expect: [{ md: 'Test1 ``` Test2\nTest3' }],
  },
  {
    name: '#1280: two inline fences on one line',
    origin: '#1280; the markdown renderer turns them into a code span',
    input: 'Test1 ``` Test2 ``` Test3\nTest4',
    expect: [{ md: 'Test1 ``` Test2 ``` Test3\nTest4' }],
  },
  {
    name: '#1280: inline fence on the last line',
    origin: '#1280',
    input: 'Test1 ``` Test2',
    expect: [{ md: 'Test1 ``` Test2' }],
  },
  {
    name: '#1280: streaming prefix, inline fence then newline',
    origin: '#1280; the unanchored regex opened a block here while streaming',
    input: 'Test1 ``` Test2\n',
    expect: [{ md: 'Test1 ``` Test2\n' }],
  },
  {
    name: 'inline fence in prose, then a real block',
    origin: '#1280',
    input: 'Use ``` to fence.\n```js\nx\n```\n',
    expect: [{ md: 'Use ``` to fence.\n' }, { code: 'x\n', title: 'js' }, { md: '\n' }],
  },
  {
    name: 'mid-line fence with glued info and no closer',
    origin: '#1280 by extension; CommonMark 4.5',
    input: 'Test1 ```Test2\nTest3',
    expect: [{ md: 'Test1 ```Test2\nTest3' }],
    open: 'indistinguishable from a glued opener (text:```lang) until a closer arrives; the glued opener is kept, so this opens',
  },

  // --- non-conformant openers. Kept: #983 2026-02-24, the lenient forms exist for non-conformant output ---

  {
    name: 'fence glued to prose opens a block',
    origin: '#983 (2026-02-24): leniency for non-conformant output. Not CommonMark',
    input: 'Here:```python\nprint(1)\n```\nMore',
    expect: [{ md: 'Here:' }, { code: 'print(1)\n', title: 'python' }, { md: '\nMore' }],
  },
  {
    name: 'untitled fence glued to prose opens a block',
    origin: '#983 (2026-02-24): leniency for non-conformant output. Not CommonMark',
    input: 'Here:```\nprint(1)\n```\nMore',
    expect: [{ md: 'Here:' }, { code: 'print(1)\n' }, { md: '\nMore' }],
  },
  {
    name: 'fence after prose and a space opens a block',
    origin: '#983 (2026-02-24): leniency for non-conformant output. Not CommonMark',
    input: 'Here: ```python\nprint(1)\n```\nMore',
    expect: [{ md: 'Here: ' }, { code: 'print(1)\n', title: 'python' }, { md: '\nMore' }],
  },

  // --- #983 (Slava-256, 2026-02): the close side. Both rows pinned as is; the asymmetry between them is the open issue ---

  {
    name: '#983: close followed by text is content',
    origin: '#983 open; CommonMark 4.5: a closing fence may be followed only by spaces. Pinned as is, not endorsed',
    input: s983Head + '```json\n' + s983Json + s983Tail,
    expect: [{ md: s983Head }, { code: s983Json + s983Tail, title: 'json', partial: true }],
  },
  {
    name: 'close followed by a space and text closes',
    origin: '2024-09-29 lookahead; #983 symmetry unresolved. Pinned as is, not endorsed',
    input: '```js\nx\n``` note\nafter',
    expect: [{ code: 'x\n', title: 'js' }, { md: ' note\nafter' }],
  },

  // --- openers ---

  {
    name: 'fence at offset 0',
    origin: 'CommonMark 4.5',
    input: '```py\nprint(1)\n```',
    expect: [{ code: 'print(1)\n', title: 'py' }],
  },
  {
    name: 'fence after text',
    origin: 'CommonMark 4.5',
    input: 'Intro\n```js\nconst a = 1;\n```\nOutro',
    expect: [{ md: 'Intro\n' }, { code: 'const a = 1;\n', title: 'js' }, { md: '\nOutro' }],
  },
  {
    name: 'untitled fence',
    origin: 'CommonMark 4.5',
    input: 'a\n```\nx\n```\n',
    expect: [{ md: 'a\n' }, { code: 'x\n' }, { md: '\n' }],
  },
  {
    name: 'fence indented 3 spaces in a list item',
    origin: 'CommonMark 5.2: fences nest in list items; the pre-pass keeps the indent in the code',
    input: '1. Step\n   ```bash\n   npm i\n   ```\n',
    expect: [{ md: '1. Step\n' }, { code: '   npm i\n', title: 'bash' }, { md: '\n' }],
  },
  {
    name: 'fence indented 4 spaces',
    origin: 'CommonMark 5.2; LLMs indent list content by 4',
    input: '- item\n    ```ts\n    x\n    ```\n',
    expect: [{ md: '- item\n' }, { code: '    x\n', title: 'ts' }, { md: '\n' }],
  },
  {
    name: 'fence indented with a tab',
    origin: 'CommonMark 5.2',
    input: '\t```ts\n\tx\n\t```\n',
    expect: [{ code: '\tx\n', title: 'ts' }, { md: '\n' }],
  },
  {
    name: 'fence on a list-marker line',
    origin: 'CommonMark 5.2: a fence may start a list item',
    input: '- ```js\n  x\n  ```\nMore',
    expect: [{ code: '  x\n', title: 'js' }, { md: '\nMore' }],
  },
  {
    name: 'info string keeps spaces and symbols',
    origin: '2024-02-06 and 2024-04-23: filenames in the info string',
    input: '```python src/app file.py\nx\n```\n',
    expect: [{ code: 'x\n', title: 'python src/app file.py' }, { md: '\n' }],
  },
  {
    name: 'backtick in the info string is not a fence',
    origin: 'CommonMark 4.5; 2024-09-29: the info string excludes backticks',
    input: '```js`x\ny\n```\n',
    expect: [{ md: '```js`x\ny\n' }, { code: '', partial: true }],
  },
  {
    name: 'fence inside a blockquote',
    origin: 'CommonMark 5.1; no ticket',
    input: '> ```js\n> x\n> ```\n',
    expect: [{ md: '> ```js\n> x\n> ```\n' }],
    open: 'container prefixes are not parsed: the block comes out with the > markers inside the code; leaving it to the markdown renderer would be the lesser evil',
  },

  // --- closers ---

  {
    name: 'close at end of text without a newline',
    origin: '2024-04-24: a close that required a newline was undone the same day; 2024-10-07: the lookahead accepts end of text',
    input: '```js\nx\n```',
    expect: [{ code: 'x\n', title: 'js' }],
  },
  {
    name: 'empty block',
    origin: '2024-06-22: a close that required a preceding newline was reverted the same day',
    input: '```js\n```\nafter',
    expect: [{ code: '', title: 'js' }, { md: '\nafter' }],
  },
  {
    name: 'close glued to the last code line',
    origin: '2024-06-22 revert. Not CommonMark; kept for non-conformant output',
    input: '```js\nx```\nafter',
    expect: [{ code: 'x', title: 'js' }, { md: '\nafter' }],
  },
  {
    name: 'close with trailing spaces',
    origin: 'CommonMark 4.5; 2024-09-29 lookahead',
    input: '```js\nx\n```   \nafter',
    expect: [{ code: 'x\n', title: 'js' }, { md: '   \nafter' }],
  },
  {
    name: 'six-tick close ends a five-tick block',
    origin: 'CommonMark 4.5: the close is at least as long as the open; 2026-05-29',
    input: '`````md\nx\n``````\nafter',
    expect: [{ code: 'x\n', title: 'md' }, { md: '\nafter' }],
  },
  {
    name: 'three-tick close does not end a four-tick block',
    origin: '2026-05-29: length-matched close',
    input: '````md\n```\nstill inside\n````\nafter',
    expect: [{ code: '```\nstill inside\n', title: 'md' }, { md: '\nafter' }],
  },

  // --- nesting ---

  {
    name: 'four containing three',
    origin: '2026-05-29',
    input: '````md\n```js\nx\n```\n````\nafter',
    expect: [{ code: '```js\nx\n```\n', title: 'md' }, { md: '\nafter' }],
  },
  {
    name: 'five containing four containing three',
    origin: '2026-05-29',
    input: '`````md\n````md\n```js\nx\n```\n````\n`````\nafter',
    expect: [{ code: '````md\n```js\nx\n```\n````\n', title: 'md' }, { md: '\nafter' }],
  },
  {
    name: 'three containing four: the longer fence closes it',
    origin: 'CommonMark 4.5: any fence at least as long closes; the outer closer then opens a new block',
    input: '```md\n````js\nx\n````\n```\nafter',
    expect: [{ code: '````js\nx\n', title: 'md' }, { md: '\n' }, { code: 'after', partial: true }],
  },
  {
    name: 'consecutive blocks',
    origin: 'CommonMark 4.5',
    input: '```a\n1\n```\ntext\n```b\n2\n```',
    expect: [{ code: '1\n', title: 'a' }, { md: '\ntext\n' }, { code: '2\n', title: 'b' }],
  },

  // --- streaming: the text is still arriving ---

  {
    name: 'unterminated block is partial',
    origin: 'streaming',
    input: 'Here:\n```js\nconst a',
    expect: [{ md: 'Here:\n' }, { code: 'const a', title: 'js', partial: true }],
  },
  {
    name: 'opener line alone is a partial block',
    origin: 'streaming',
    input: '```js\n',
    expect: [{ code: '', title: 'js', partial: true }],
  },
  {
    name: 'opener without its newline is still text',
    origin: 'streaming: the info string is not complete until the newline',
    input: '```js',
    expect: [{ md: '```js' }],
  },
  {
    name: 'nested stream cut inside the innermost fence',
    origin: 'streaming; 2026-05-29',
    input: '`````md\n````md\n```js\nx',
    expect: [{ code: '````md\n```js\nx', title: 'md', partial: true }],
  },

  // --- the other pre-pass patterns ---

  {
    name: 'html document between text',
    origin: 'htmlCodeBlock pattern',
    input: 'see\n<!DOCTYPE html><html><body>hi</body></html>\nafter',
    expect: [{ md: 'see\n' }, { code: '<!DOCTYPE html><html><body>hi</body></html>', title: 'html' }, { md: '\nafter' }],
  },
  {
    name: 'svg between text',
    origin: 'svgBlock pattern',
    input: 'see\n<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>\nafter',
    expect: [{ md: 'see\n' }, { code: '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', title: 'svg' }, { md: '\nafter' }],
  },

  // --- known gaps ---

  {
    name: 'CRLF line endings',
    origin: 'CommonMark 2.1: CRLF is a line ending; reaches the parser through imports',
    input: 'a\r\n```js\r\nx\r\n```\r\nb',
    expect: [{ md: 'a\r\n' }, { code: 'x\r\n', title: 'js' }, { md: '\r\nb' }],
  },
  {
    name: 'CRLF untitled fence glued to prose',
    origin: 'CommonMark 2.1 with the glued-opener leniency',
    input: 'Here:```\r\nx\r\n```\r\nb',
    expect: [{ md: 'Here:' }, { code: 'x\r\n' }, { md: '\r\nb' }],
  },
  {
    name: 'tilde fences',
    origin: 'CommonMark 4.5',
    input: '~~~js\nx\n~~~\n',
    expect: [{ code: 'x\n', title: 'js' }, { md: '\n' }],
    open: 'tilde fences are not recognized; LLMs do not emit them',
  },

  // --- time bounds ---

  {
    name: 'whitespace-led lines, 200KB',
    origin: '#752: whitespace runs are the known backtracking trap',
    input: padLines + '```js\nx\n```',
    expect: [{ md: padLines }, { code: 'x\n', title: 'js' }],
    maxMs: 100,
  },
  {
    name: 'one 100KB whitespace run',
    origin: '#752 gist shape',
    input: padRun + '```js\nx\n```',
    expect: [{ md: padRun }, { code: 'x\n', title: 'js' }],
    maxMs: 100,
  },

];


function project(blocks: RenderBlockInputs): FenceExpectBlock[] {
  return normalizeFenceBlocks(blocks.map((b): FenceExpectBlock => {
    switch (b.bkt) {
      case 'md-bk':
        return { md: b.content };
      case 'code-bk':
        return { code: b.code, ...(b.title ? { title: b.title } : {}), ...(b.isPartial ? { partial: true } : {}) };
      default:
        throw new Error(`unexpected block kind: ${b.bkt}`);
    }
  }));
}

const kinds = (blocks: RenderBlockInputs) => blocks.map(b => b.bkt);

// failure messages: long strings cut, so the 200KB rows stay readable
const cut = (s: string) => s.length > 80 ? `${s.slice(0, 60)}...(${s.length} chars)` : s;
const show = (blocks: FenceExpectBlock[]) =>
  '[' + blocks.map(b => JSON.stringify('md' in b ? { md: cut(b.md) } : { ...b, code: cut(b.code) })).join(', ') + ']';

/** Every prefix of a row is a state the UI renders mid-stream; returns the first violated invariant, if any. */
function streamingViolation(c: FenceCase): string | null {
  const finalKinds = kinds(parseBlocksFromText(c.input));
  const finalHasCode = finalKinds.includes('code-bk');
  for (let n = 1; n < c.input.length; n++) {
    const prefix = c.input.slice(0, n);
    const blocks = parseBlocksFromText(prefix);
    const at = `at prefix ${n}: ${JSON.stringify(prefix)}`;
    // a code block's source span stays inside the text
    for (const b of blocks)
      if (b.bkt === 'code-bk' && !(b.sourceStart !== undefined && b.sourceEnd !== undefined && b.sourceStart < b.sourceEnd && b.sourceEnd <= n))
        return `span out of range ${at}`;
    // a block keeps its kind once a later block exists (the hook recycles ids on that assumption)
    if (!isDeepStrictEqual(kinds(blocks).slice(0, -1), finalKinds.slice(0, blocks.length - 1)))
      return `block kind changed ${at}`;
    // prose never shows a code block on its way to being prose (#1280 streaming flicker)
    if (!finalHasCode && blocks.some(b => b.bkt === 'code-bk'))
      return `spurious code block ${at}`;
  }
  return null;
}

const enforced = FENCE_CASES.filter(c => !c.open);
const gaps = FENCE_CASES.filter(c => c.open);
const streamed = enforced.filter(c => !c.maxMs);
const bounded = FENCE_CASES.filter(c => c.maxMs);


describe('parseBlocksFromText: fences', () => {

  it(`${enforced.length} rows parse as expected`, () => {
    const off = enforced.flatMap(c => {
      const got = project(parseBlocksFromText(c.input));
      return isDeepStrictEqual(got, c.expect) ? [] : [`${c.name}\n      origin:   ${c.origin}\n      expected: ${show(c.expect)}\n      got:      ${show(got)}`];
    });
    assert.equal(off.length, 0, `${off.length} row(s) off:\n    ${off.join('\n    ')}`);
  });

  it(`${streamed.length} rows are stable across streaming prefixes`, () => {
    const off = streamed.flatMap(c => {
      const v = streamingViolation(c);
      return v ? [`${c.name}: ${v}`] : [];
    });
    assert.equal(off.length, 0, `${off.length} row(s) unstable:\n    ${off.join('\n    ')}`);
  });

  it(`${bounded.length} large inputs parse under their bound`, () => {
    const off = bounded.flatMap(c => {
      parseBlocksFromText(c.input); // warm
      const t0 = performance.now();
      parseBlocksFromText(c.input);
      const ms = performance.now() - t0;
      return ms < (c.maxMs ?? 0) ? [] : [`${c.name}: ${ms.toFixed(1)}ms, bound ${c.maxMs}ms`];
    });
    assert.equal(off.length, 0, `${off.length} input(s) over bound:\n    ${off.join('\n    ')}`);
  });

  it(`${gaps.length} known gaps still open`, () => {
    const closed = gaps.filter(c => isDeepStrictEqual(project(parseBlocksFromText(c.input)), c.expect));
    assert.equal(closed.length, 0, `${closed.length} gap(s) now pass; promote them by removing \`open\`:\n    ${closed.map(c => c.name).join('\n    ')}`);
  });

});
