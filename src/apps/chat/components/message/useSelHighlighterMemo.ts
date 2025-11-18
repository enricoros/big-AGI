import * as React from 'react';

import type { DMessageId } from '~/common/stores/chat/chat.message';
import { createTextContentFragment, DMessageContentFragment, DMessageFragment, DMessageFragmentId, isTextContentFragment } from '~/common/stores/chat/chat.fragments';
import { wrapWithMarkdownSyntax } from '~/modules/blocks/markdown/markdown.wrapper';

import { BUBBLE_MIN_TEXT_LENGTH } from './ChatMessage';


/**
 * Text matching strategy for selection highlighting:
 * - 'exact': Direct substring match in source (former behavior)
 * - 'md-approx': Markdown-approximate match - finds rendered text in decorated source (new behavior)
 */
const MATCH_METHOD: 'exact' | 'md-approx' = 'md-approx';


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
const APPLY_CUT = (_text: string) => ''; // Cut removes the text entirely

type HighlightTool = 'highlight' | 'strike' | 'strong' | 'cut';


// -- Matcher algorithms --

/**
 * Result from text matching: the source substring and the inner text to apply tools to
 */
interface MatchResult {
  sourceText: string;  // Text in source (may include decorators)
  selText: string;   // Text to apply tool to (decorators stripped)
  leadingDecorators: string;
  trailingDecorators: string;
}

/**
 * Finds text using exact substring matching.
 */
function findExactMatch(needle: string, haystack: string): MatchResult | null {
  const firstIndex = haystack.indexOf(needle);
  if (firstIndex === -1) return null;

  // Ensure uniqueness - only one occurrence
  if (haystack.indexOf(needle, firstIndex + 1) !== -1) return null;

  return {
    sourceText: needle,
    selText: needle,
    leadingDecorators: '',
    trailingDecorators: '',
  };
}

/**
 * Finds text in source markdown by stripping decorators and tracking positions.
 * Returns the source substring (including decorators) that renders to the needle text.
 */
function findInMarkdownSource(needle: string, haystack: string): MatchResult | null {

  // 1. strip markdown decorators while tracking positions
  let stripped = '';
  const posMap: number[] = []; // stripped char index -> haystack char index

  let i = 0;
  while (i < haystack.length) {
    const char = haystack[i];

    // skip common markdown decorator characters
    if (char === '*' || char === '_' || char === '~' || char === '`') {
      i++;
      continue;
    }

    // regular character - track position
    stripped += char;
    posMap.push(i);
    i++;
  }

  // if the needle is empty after stripping -- nothing we can do here
  const idx = stripped.indexOf(needle);
  if (idx === -1) {
    // not found - need a different approach
    return null;
  }

  // ensure uniqueness - only one occurrence
  if (stripped.indexOf(needle, idx + 1) !== -1) {
    // multiple occurrences - need a different approach
    return null;
  }

  // map back to source positions
  const startPos = posMap[idx];
  const endIdx = idx + needle.length - 1;
  const endPos = endIdx < posMap.length ? posMap[endIdx] + 1 : haystack.length;

  // expand to include surrounding markdown decorators
  let actualStart = startPos;
  let actualEnd = endPos;

  // walk backwards to include opening decorators
  while (actualStart > 0) {
    const prevChar = haystack[actualStart - 1];
    if (prevChar === '*' || prevChar === '_' || prevChar === '~' || prevChar === '`')
      actualStart--;
    else
      break;
  }

  // walk forwards to include closing decorators
  while (actualEnd < haystack.length) {
    const nextChar = haystack[actualEnd];
    if (nextChar === '*' || nextChar === '_' || nextChar === '~' || nextChar === '`')
      actualEnd++;
    else
      break;
  }

  const sourceText = haystack.substring(actualStart, actualEnd);
  const leadingDecorators = sourceText.match(/^[*_~`]+/)?.[0] || '';
  const trailingDecorators = sourceText.match(/[*_~`]+$/)?.[0] || '';
  const selText = sourceText.slice(leadingDecorators.length, sourceText.length - trailingDecorators.length);

  return { sourceText, selText, leadingDecorators, trailingDecorators };
}


export function useSelHighlighterMemo(
  messageId: DMessageId,
  selText: string | null,
  fragments: DMessageContentFragment[],
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
        const match = MATCH_METHOD === 'md-approx'
          ? findInMarkdownSource(selText, fragmentText)
          : findExactMatch(selText, fragmentText);

        if (match) {
          // If we already found one, this is a duplicate
          if (acc) return true;

          const { sourceText, selText, leadingDecorators, trailingDecorators } = match;

          // Tool application function
          acc = (tool: HighlightTool) => {

            // Apply the tool to the inner text
            const selProcessed =
              tool === 'highlight' ? APPLY_HTML_HIGHLIGHT(selText)
                : tool === 'strike' ? APPLY_HTML_STRIKE(selText)
                  : tool === 'strong' ? APPLY_MD_STRONG(selText)
                    : tool === 'cut' ? APPLY_CUT(selText)
                      : selText;

            // Reconstruct with original decorators
            const reconstructed = leadingDecorators + selProcessed + trailingDecorators;

            // Toggle, if the tooled text is already present (except for cut which always removes)
            const newFragmentText =
              tool === 'cut' ? fragmentText.replace(sourceText, reconstructed) // Cut always removes text
                : fragmentText.includes(reconstructed) ? fragmentText.replace(reconstructed, sourceText) // toggles selection
                  : fragmentText.replace(sourceText, reconstructed);

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
