import * as React from 'react';

import type { DMessageId } from '~/common/stores/chat/chat.message';
import { createTextContentFragment, DMessageContentFragment, DMessageFragment, DMessageFragmentId, isTextPart } from '~/common/stores/chat/chat.fragments';


// configuration
const MIN_SEL_LENGTH = 3;


export function useSelHighlighterMemo(
  messageId: DMessageId,
  selText: string | null,
  contentFragments: DMessageContentFragment[],
  fromAssistant: boolean,
  onMessageFragmentReplace?: (messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void,
): (() => void) | null {
  return React.useMemo(() => {

    // Existence check
    if (!selText
      || selText.length < MIN_SEL_LENGTH
      || selText.includes('```') // checks that we don't include a code block start (or end) in the selection
      || !fromAssistant
      || !onMessageFragmentReplace
    )
      return null;

    // Create the highlighter function, if there's 1 and only 1 occurrence of the selection
    const highlightFunction = contentFragments.reduce((acc: false /* not found */ | (() => void) | true /* more than one */, fragment) => {
      if (!acc && isTextPart(fragment.part)) {
        const text = fragment.part.text;
        let index = text.indexOf(selText);

        while (index !== -1) {

          // If we've found more than one occurrence, we can stop
          if (acc) return true;

          index = text.indexOf(selText, index + 1);

          // make the highlighter function
          acc = () => {
            const highlighted = `==${selText}==`;
            const newFragmentText =
              text.includes(highlighted) ? text.replace(highlighted, selText) // toggles selection
                : text.replace(selText, highlighted);
            onMessageFragmentReplace(messageId, fragment.fId, createTextContentFragment(newFragmentText));
          };
        }
      }
      return acc;
    }, false);

    return typeof highlightFunction === 'function' ? highlightFunction : null;
  }, [selText, fromAssistant, onMessageFragmentReplace, contentFragments, messageId]);
}
