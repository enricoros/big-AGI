import * as React from 'react';

import { agiId } from '~/common/util/idUtils';
import { countLines } from '~/common/util/textUtils';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import type { RenderBlockInputs } from './blocks.types';
import type { WordsDiff } from './wordsdiff/RenderWordsDiff';
import { parseBlocksFromText } from './blocks.textparser';


// configuration
const USER_COLLAPSED_LINES: number = 8;


export function useTextCollapser(origText: string, enable: boolean) {

  // state
  const [forceTextExpanded, setForceTextExpanded] = React.useState(false);

  // quick memo
  const { text, isTextCollapsed } = React.useMemo(() => {
    // nothing to do
    if (!enable || forceTextExpanded)
      return { text: origText, isTextCollapsed: false };

    // count lines
    const textLines = origText.split('\n');
    if (textLines.length <= USER_COLLAPSED_LINES)
      return { text: origText, isTextCollapsed: false };

    // chop to the first few lines
    return { text: textLines.slice(0, USER_COLLAPSED_LINES).join('\n'), isTextCollapsed: true };
  }, [enable, forceTextExpanded, origText]);

  // memo handlers
  const handleToggleExpansion = React.useCallback(() => setForceTextExpanded(on => !on), []);

  return {
    text,
    isTextCollapsed,
    forceTextExpanded,
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
 * - when the AutoBlocksRenderer goes from non-memo to Memo: reassigned: *
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