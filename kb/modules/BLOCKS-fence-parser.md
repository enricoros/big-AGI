# Blocks: fenced code pre-pass

Status: SHIPPED (opener rule, corpus, single-scan loop, CRLF). OPEN: the close side (#983), container prefixes.

`parseBlocksFromText` splits message text into markdown and code blocks before react-markdown sees
it, so code blocks get their own renderer. It runs on every streaming update of every message, over
the whole text. The fence regex and the loop that applies it are the contract of record; this doc
holds the rule, the corpus, and the measurements behind the shape.

## The opener rule

A fence opens a block when it starts its line, after any indentation and an optional list marker, or
mid-line only when glued: a newline or the info string right after the backticks. A mid-line fence
followed by a space is prose (#1280, Slava-256). The glued mid-line form is not CommonMark and is kept
on purpose: models emit `Here:```python` and `Here: ```python`, and the maintainer position in #983
(2026-02-24) is that the lenient forms exist for non-conformant output.

The close side is unchanged: a fence at least as long as the opener, followed by a space, asterisk,
carriage return, newline or end of text; a block with no close is partial, which is what a streaming message looks like
until its close arrives. Two close-side behaviors are pinned as is and not endorsed: a close followed
directly by text is content (CommonMark agrees), a close followed by a space and text closes (CommonMark
disagrees). Their asymmetry is #983, still open.

The rule is a predicate in the loop, not a lookbehind in the regex. See the measurements.

The loop keeps each pattern's next match and re-runs a pattern only once the cursor passes it, so the
three regexes scan the text once each. Before that, every block rescanned the rest of the text for the
HTML and SVG patterns: 200KB with 240 fences cost 7 ms per parse, 2000 fences 31 ms in Node and 109 ms
on Safari, against 0.2 and 0.8 ms now. The parse runs on every streaming update.

## The corpus

`src/modules/blocks/blocks.textparser.test.ts` holds one row per behavior, each with its origin: an
issue, the regex change or revert that introduced it, or the CommonMark section. Newer tickets and
comments supersede older ones. Four checks, one line of output each when green: the full parse of every
row, every character prefix of every row (span inside the text, block kind stable once a later block
exists, no code block while prose streams in), a time bound on two 100-200KB whitespace inputs (the
#752 shape), and the known gaps, asserted to still fail so that the fix closing one is told to promote
the row. Flipping any row is a decision, made in the same commit as the parser change.

Rows do not depend on where a block's source span starts: the indentation or list marker on the fence's
own line is dropped before comparing.

## Measurements

Measured 2026-11-04 on macOS 15.6: Safari 27.2 (JavaScriptCore), Chrome 154 (V8), Firefox 159
(SpiderMonkey). Milliseconds per parse of 200KB of prose, adaptive loop of at least 150 ms per cell.
Rows are the 35 enforced corpus rows.

| Shape | rows | Safari | Chrome | Firefox | Verdict |
|---|---|---|---|---|---|
| previous regex, opener unanchored | 31 | 0.13 | 0.02 | 0.06 | fails the four #1280 rows |
| PR #1282: opener anchored to line start by lookbehind | 31 | 2.3 | 0.03 | 0.10 | drops three glued-opener rows and the list-marker fence |
| the rule as a lookbehind-led regex | 35 | 5.4 | 0.33 | 0.89 | WebKit interpreter |
| the rule as a regex, fence literal first, lookbehind after | 35 | 1.2 | 0.02 | 0.07 | WebKit interpreter, 10x on streaming bodies |
| the rule as a loop predicate, regex unchanged (adopted) | 35 | 0.12 | 0.02 | 0.08 | |
| indentation inside a variable-length lookbehind | | 2800 at 50K spaces | 0.00 | 0.00 | quadratic on WebKit |
| adopted opener plus a CommonMark close (the #983 step) | 32 | | | | loses two kept rows: a close glued to the last code line, a close followed by a space and text |

WebKit's regex JIT does not compile lookbehind, so a single lookbehind drops the whole pattern into the
interpreter: 10x on any shape, 20-40x on shapes whose work is the opener scan. Every shape above is
linear in the input; the quadratic one is listed because it is the obvious refactor and the one to
avoid. Chrome and Firefox scan for the first literal before evaluating conditions and show none of
this. iOS is WebKit in every browser.

Consequence for the streaming path: no lookbehind in a regex that runs per update over message text.

## Open

- #983: the close side. The CommonMark close measured above costs two kept rows; the stack-based parser
  explored in the issue was not adopted. Trigger to revisit: a report where a close followed by text
  swallows prose, with a sample.
- Container prefixes: a fence inside a blockquote comes out with the `> ` markers inside the code. Leaving
  it to the markdown renderer loses the code chrome. Fences inside list items work because any
  indentation is accepted and kept in the code.
- A mid-line fence with glued info and no closer, `Test1 ```Test2`, opens a block: indistinguishable
  from a glued opener until a closer arrives.
