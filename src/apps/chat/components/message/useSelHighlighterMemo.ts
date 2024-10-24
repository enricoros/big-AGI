import * as React from 'react';

import type { DMessageId } from '~/common/stores/chat/chat.message';
import { createTextContentFragment, DMessageFragment, DMessageFragmentId, isTextContentFragment } from '~/common/stores/chat/chat.fragments';
import { wrapWithMarkdownSyntax } from '~/modules/blocks/markdown/markdown.wrapper';

import { BUBBLE_MIN_TEXT_LENGTH } from './ChatMessage';


/* Note: future evolution of Marking:
 * 'data-purpose'?: 'review' | 'important' | 'note'; // Purpose of the highlight
 * 'data-user-id'?: string; // Unique user identifier
 * 'data-context'?: string; // Context or description of the highlight
 * 'data-version'?: string; // Version of the document/content
 * 'data-platform'?: 'web' | 'mobile' | 'extension'; // Platform or tool that created the highlight
 * 'data-category'?: string; // Category for organization
 *
 * Example:
 * <mark id="highlight-123" data-purpose="important" data-user-id="user123" data-context="Key point in the document" data-version="1.0" data-platform="web" data-category="summary">
 *   This is an important highlight.
 * </mark>
 */
const APPLY_HTML_HIGHLIGHT = (text: string) => `<mark>${text}</mark>`;
const APPLY_HTML_STRIKE = (text: string) => `<del>${text}</del>`;
const APPLY_MD_STRONG = (text: string) => wrapWithMarkdownSyntax(text, '**');

type HighlightTool = 'highlight' | 'strike' | 'strong';

export function useSelHighlighterMemo(
  messageId: DMessageId,
  selText: string | null,
  fragments: DMessageFragment[],
  fromAssistant: boolean,
  onMessageFragmentReplace?: (messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void,
): ((tool: HighlightTool) => void) | null {
  return React.useMemo(() => {

    // Existence check
    if (!selText || selText.length < BUBBLE_MIN_TEXT_LENGTH || !fromAssistant || !onMessageFragmentReplace)
      return null;

    // Create the highlighter function, if there's 1 and only 1 occurrence of the selection
    const highlightFunction = fragments.reduce((acc: false /* not found */ | ((tool: HighlightTool) => void) | true /* more than one */, fragment) => {
      if (!acc && isTextContentFragment(fragment)) {
        const fragmentText = fragment.part.text;
        let index = fragmentText.indexOf(selText);

        while (index !== -1) {

          // If we've found more than one occurrence, we can stop
          if (acc) return true;

          index = fragmentText.indexOf(selText, index + 1);

          // Tool application function
          acc = (tool: HighlightTool) => {

            // Apply the tool
            const highlighted =
              tool === 'highlight' ? APPLY_HTML_HIGHLIGHT(selText)
                : tool === 'strike' ? APPLY_HTML_STRIKE(selText)
                  : tool === 'strong' ? APPLY_MD_STRONG(selText)
                    : selText;

            // Toggle, if the tooled text is already present
            const newFragmentText =
              fragmentText.includes(highlighted) ? fragmentText.replace(highlighted, selText) // toggles selection
                : fragmentText.replace(selText, highlighted);

            // Replace the whole fragment within the message
            onMessageFragmentReplace(messageId, fragment.fId, createTextContentFragment(newFragmentText));

          };
        }
      }
      return acc;
    }, false);

    return typeof highlightFunction === 'function' ? highlightFunction : null;
  }, [fragments, fromAssistant, messageId, onMessageFragmentReplace, selText]);
}
