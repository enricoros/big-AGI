import * as React from 'react';
import type { Diff as SanityTextDiff } from '@sanity/diff-match-patch';

import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import type { RenderBlockInputs } from './blocks.types';
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


export function useAutoBlocksMemo(text: string, forceCodeWithTitle: string | undefined, forceMarkdown: boolean, forceSanityTextDiffs: SanityTextDiff[] | undefined): RenderBlockInputs {

  // state - previous blocks, to stabilize objects
  const prevBlocksRef = React.useRef<RenderBlockInputs>([]);

  return React.useMemo(() => {

    // follow outside direction, or activate the auto-splitter based on content
    const newBlocks: RenderBlockInputs = [];
    if (forceCodeWithTitle !== undefined)
      newBlocks.push({ bkt: 'code-bk', title: forceCodeWithTitle, code: text, isPartial: false });
    else if (forceMarkdown)
      newBlocks.push({ bkt: 'md-bk', content: text });
    else if (forceSanityTextDiffs && forceSanityTextDiffs.length >= 1)
      newBlocks.push({ bkt: 'txt-diffs-bk', sanityTextDiffs: forceSanityTextDiffs });
    else
      newBlocks.push(...parseBlocksFromText(text));

    // recycle the previous blocks if they are the same, for stable references to React
    const recycledBlocks: RenderBlockInputs = [];
    for (let i = 0; i < newBlocks.length; i++) {
      const newBlock = newBlocks[i];
      const prevBlock = prevBlocksRef.current[i] ?? undefined;

      // Check if the new block can be replaced by the previous block to maintain reference stability
      if (prevBlock && shallowEquals(prevBlock, newBlock)) {
        recycledBlocks.push(prevBlock);
      } else {
        // Once a block doesn't match, we use the new blocks from this point forward.
        recycledBlocks.push(...newBlocks.slice(i));
        break;
      }
    }

    // Update prevBlocksRef with the current blocks for the next render
    prevBlocksRef.current = recycledBlocks;

    return recycledBlocks;
  }, [forceCodeWithTitle, forceMarkdown, forceSanityTextDiffs, text]);
}