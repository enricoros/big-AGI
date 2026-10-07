import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';

import { ContentScaling, lineHeightChatTextMd, themeScalingMap } from '~/common/app.theme';
import { agiId } from '~/common/util/idUtils';
import { countLines } from '~/common/util/textUtils';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import type { RenderBlockInputs } from './blocks.types';
import type { WordsDiff } from './wordsdiff/RenderWordsDiff';
import { parseBlocksFromText } from './blocks.textparser';


// configuration
const COLLAPSED_LINES = 10; // clip height, in lines of the scaled block text
const COLLAPSE_MIN_HIDDEN_LINES = 3; // never collapse to hide fewer lines than this


/**
 * Collapses long content by clipping its rendered height. The content always renders in full, so edits, copy and find
 * operate on all of it - never chop the text instead: in-place actions would write the chopped text back.
 * `contentRef` goes on an unconstrained element inside the one styled with `clipSx`.
 */
export function useHeightCollapser(enabled: boolean, contentScaling: ContentScaling) {

  // state
  const [isLong, setIsLong] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // derived
  const fontSize = themeScalingMap[contentScaling]?.blockFontSize;
  const lineHeight = Number(themeScalingMap[contentScaling]?.blockLineHeight) || lineHeightChatTextMd;
  const isCollapsed = enabled && isLong && !isExpanded;

  // measure before paint, so long content never flashes in full, then on every resize
  React.useLayoutEffect(() => {
    const contentEl = contentRef.current;
    if (!enabled || !contentEl) return;
    const measure = () => {
      const linePx = (parseFloat(getComputedStyle(contentEl).fontSize) || 16) * lineHeight;
      setIsLong(contentEl.offsetHeight > linePx * (COLLAPSED_LINES + COLLAPSE_MIN_HIDDEN_LINES));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(contentEl);
    return () => observer.disconnect();
  }, [enabled, lineHeight]);

  // font size and line height as the text blocks, so 'em' is one line
  const clipSx = React.useMemo((): SxProps => ({
    fontSize,
    lineHeight,
    ...(isCollapsed && {
      maxHeight: `${COLLAPSED_LINES * lineHeight}em`,
      overflow: 'clip',
      maskImage: 'linear-gradient(to bottom, black calc(100% - 2.5em), transparent)',
    }),
  }), [fontSize, isCollapsed, lineHeight]);

  const handleToggleExpansion = React.useCallback(() => setIsExpanded(on => !on), []);

  return {
    contentRef,
    clipSx,
    isCollapsed,
    showToggle: enabled && isLong,
    handleToggleExpansion,
  };
}


// Helper function to compare blocks without considering their IDs
function areBlocksEqualIdIgnored(block1: RenderBlockInputs[number] | undefined, block2: RenderBlockInputs[number] | undefined): boolean {
  if (!block1 || !block2)
    return false;
  const { bkId: _, ...rest1 } = block1;
  const { bkId: __, ...rest2 } = block2;
  return shallowEquals(rest1, rest2);
}


/**
 * Note: this will keep generally stable IDs, but will change them when:
 * - when the text is still being parsed, e.g. a string will find a "```" block
 *   as part of the the running text, in which case the growing text will be
 *   reassigned (when it's chopped to before the code block, in the next call)
 */
export function useAutoBlocksMemoSemiStable(text: string, forceAsFenced: string | undefined, forceAsMarkdown: boolean, forceAsWordsDiff: WordsDiff | undefined, selectSingleCodeBlock: boolean): RenderBlockInputs {

  // state - previous blocks, to stabilize objects
  const prevBlocksRef = React.useRef<RenderBlockInputs>([]);
  const prevTextRef = React.useRef('');

  return React.useMemo(() => {
    let newBlocks: RenderBlockInputs;
    if (forceAsFenced !== undefined)
      newBlocks = [{ bkt: 'code-bk', title: forceAsFenced, code: text, lines: countLines(text), isPartial: false }];
    else if (forceAsMarkdown)
      newBlocks = [{ bkt: 'md-bk', content: text }];
    else if (forceAsWordsDiff && forceAsWordsDiff.length >= 1)
      newBlocks = [{ bkt: 'txt-diffs-bk', wordsDiff: forceAsWordsDiff }];
    else {
      newBlocks = parseBlocksFromText(text);
      if (selectSingleCodeBlock && newBlocks.length > 1)
        newBlocks = newBlocks.filter(({ bkt }) => bkt === 'code-bk');
    }

    const recycledBlocks: RenderBlockInputs = newBlocks.map((newBlock, index) => {
      const prevBlock = prevBlocksRef.current[index] ?? undefined;
      const isLastBlock = index === newBlocks.length - 1;
      const isStreaming = isLastBlock && text.startsWith(prevTextRef.current);

      if (areBlocksEqualIdIgnored(prevBlock, newBlock))
        return prevBlock;

      if (isStreaming && prevBlock?.bkt === newBlock.bkt)
        return { ...newBlock, bkId: prevBlock.bkId };

      return { ...newBlock, bkId: agiId('chat-block') };
    });

    prevBlocksRef.current = recycledBlocks;
    prevTextRef.current = text;

    return recycledBlocks;
  }, [forceAsFenced, forceAsMarkdown, forceAsWordsDiff, selectSingleCodeBlock, text]);
}