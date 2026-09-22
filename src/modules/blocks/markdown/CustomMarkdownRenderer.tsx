import * as React from 'react';

import type { Pluggable as UnifiedPluggable } from 'unified';
import { Components as ReactMarkdownComponents, default as ReactMarkdown, defaultUrlTransform, type UrlTransform } from 'react-markdown';
import { default as rehypeKatex } from 'rehype-katex';
import { default as remarkGfm } from 'remark-gfm';
import { default as remarkMath } from 'remark-math';
import { remarkMark } from 'remark-mark-highlight';

import { useUXLabsStore } from '~/common/stores/store-ux-labs';

import type { RenderMarkdownRendererProps } from './RenderMarkdown';
import { CustomARenderer } from './CustomARenderer';
import { CustomInputRenderer, rehypeTaskListRenumber, useMarkdownTaskListToggler } from './CustomTaskListRenderer';
import { CustomTableRenderer } from './CustomTableRenderer';
import { remarkTableCellBreaks } from './tableBreaks.remark';
import { wrapWithMarkdownSyntax } from './markdown.wrapper';


// DelRenderer adds a strikethrough to the text
function DelRenderer({ children }: { children: React.ReactNode }) {
  return <del className='agi-content-delete'>{children}</del>;
}

// Mark Renderer adds a yellow background to the text
function MarkRenderer({ children }: { children: React.ReactNode }) {
  // Mark by default has a yellow background, but we want to set a custom class here, so we can style it
  return <mark className='agi-highlight'>{children}</mark>;
}


// configuration
const MAX_PREPROCESSOR_LENGTH = 50_000; // 50kB, this is the max length of the text we want to preprocess for annotations/formulas


// shared components for the markdown renderer

const reactMarkdownComponents = {
  a: CustomARenderer, // override the link renderer to add target="_blank"
  input: CustomInputRenderer, // renders <input type="checkbox"> in a custom manner
  del: DelRenderer, // renders the <del> tag (~~strikethrough~~)
  mark: MarkRenderer, // renders the <mark> tag (==highlight==)
  table: CustomTableRenderer, // override the table renderer to show the download CSV links and Copy Markdown button
  // math/inlineMath components are not needed, rehype-katex handles this automatically
} as ReactMarkdownComponents;

// Let model-sandbox hrefs ('sandbox:/mnt/data/...' from the OpenAI code interpreter) reach CustomARenderer: the default
// transform passes only http(s)/irc(s)/mailto/xmpp and blanks every other scheme, and an <a href=''> resolves to the
// app's own origin (#1208)
const urlTransformKeepSandbox: UrlTransform = (url, key) =>
  (key === 'href' && /^sandbox:/i.test(url)) ? url : defaultUrlTransform(url);

const remarkPlugins: UnifiedPluggable[] = [
  remarkGfm, // GitHub Flavored Markdown
  remarkMark, // Mark-Highlight, for ==yellow==
  remarkTableCellBreaks, // Convert <br> HTML tags inside tables to break nodes (for line breaks in table cells)
  // NOTE: remarkMath is appended in CustomMarkdownRenderer below, because its `singleDollarTextMath` option
  // is driven by a Labs flag - some users like $...$ math despite the official LaTeX docs recommending against
  // it (https://docs.mathjax.org/en/latest/input/tex/delimiters.html), as it clashes with currency ($10) and tickers.
];

// NOTE: rehypePluginsStable: UnifiedPluggable[] is generated dynamically


let warnedAboutLength = false;
let warnedAboutPreprocessor = false;

// NOTE: no leading (\s*) capture here - it backtracks quadratically on long whitespace runs (#752)
const INLINE_LATEX_REGEX = /\\\(([^\n]*?)\\\)/g;
// noinspection RegExpRedundantEscape
const BLOCK_LATEX_REGEX = /\\\[((?:.|\n)*?)\\\]/g;

/*
 * Convert OpenAI-style markdown with LaTeX to 'remark-math' compatible format.
 * Note that inline or block will both be converted to $$...$$ format, and we
 * disable on purpose the single dollar sign for inline math, as it can clash
 * with other markdown syntax.
 */
function preprocessMarkdown(markdownText: string) {
  try {
    // for performance, disable the preprocessor if the text is too long
    if (markdownText.length > MAX_PREPROCESSOR_LENGTH) {
      if (!warnedAboutLength) {
        console.log('[DEV] Preprocessing markdown: text too long, skipping');
        warnedAboutLength = true;
      }
      return markdownText;
    }
    return markdownText
      // Replace LaTeX delimiters with $$...$$
      // Replace inline LaTeX delimiters \( and \) with $$
      // [2025-04-20] NOTE: it was reported that we had infinite recursion on the (.*?) version of inline math; as such, we now stay on the same line
      .replace(INLINE_LATEX_REGEX, (_match, mathContent) =>
        `$$${mathContent}$$`,
      )
      // Replace block LaTeX delimiters \[ and \] with $$
      .replace(BLOCK_LATEX_REGEX, (_match, mathContent) =>
        `$$${mathContent}$$`,
      )
      // Replace <mark>...</mark> with ==...==, but not in multiple lines, or if preceded by a backtick (disabled, was (?<!`))
      .replace(/<mark>([\s\S]*?)<\/mark>/g, (_match, p1) => wrapWithMarkdownSyntax(p1, '=='))
      // Replace <del>...</del> with ~~...~~, but not in multiple lines, or if preceded by a backtick (disabled, was (?<!`))
      .replace(/<del>([\s\S]*?)<\/del>/g, (_match, p1) => wrapWithMarkdownSyntax(p1, '~~'));
  } catch (error: any) {
    if (!warnedAboutPreprocessor) {
      console.warn('[DEV] Issue with the markdown preprocessor. Please open a bug with the offending text.', { error, markdownText });
      warnedAboutPreprocessor = true;
    }
    return markdownText;
  }
}


export default function CustomMarkdownRenderer({ content, disablePreprocessor, onParseCost, replaceContent }: RenderMarkdownRendererProps) {

  const enableCustomTaskList = replaceContent !== undefined;

  // external state
  const singleDollarLatex = useUXLabsStore((s) => s.labsSingleDollarLatex);
  const taskListContainerRef = useMarkdownTaskListToggler(content, replaceContent);


  // memo plugins

  const remarkPluginsStable = React.useMemo<UnifiedPluggable[]>(() => [
    ...remarkPlugins,
    [remarkMath, { singleDollarTextMath: singleDollarLatex }],
  ], [singleDollarLatex]);
  const rehypePluginsStable: UnifiedPluggable[] = React.useMemo(() => [
    rehypeKatex, // KaTeX
    ...(enableCustomTaskList ? [rehypeTaskListRenumber] : []), // supports numbering of checkboxes
  ], [enableCustomTaskList]);


  // -- Measure Parse Time --

  // parse here, called directly - `Markdown` is a plain function (the hooks live in `MarkdownHooks`) - so an in-flux block
  // measured by a render decay zone can time it; reported after the commit, as the zone's update re-renders other components
  const parseMsRef = React.useRef(0);
  const tStart = onParseCost ? performance.now() : 0;
  const markdown = ReactMarkdown({
    components: reactMarkdownComponents,
    remarkPlugins: remarkPluginsStable,
    rehypePlugins: rehypePluginsStable,
    urlTransform: urlTransformKeepSandbox,
    children: disablePreprocessor ? content : preprocessMarkdown(content),
  });
  if (onParseCost) parseMsRef.current = performance.now() - tStart;

  // -- Report Parse Time (outside the Render function) --

  // report after commit, once per committed parse: streaming renders are SyncLane, so this runs in the same task
  React.useEffect(() => {
    if (!onParseCost || !parseMsRef.current) return;
    onParseCost(parseMsRef.current);
    parseMsRef.current = 0;
  });


  return (
    <div
      ref={taskListContainerRef}
      className='markdown-body' // moved this here (formerly in RenderMarkdown.tsx) to avoid changing CSS rules for depth of matching
    >
      {markdown}
    </div>
  );
}