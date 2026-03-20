import { isVoidThinkingFragment } from '~/common/stores/chat/chat.fragments';
import type { InterleavedFragment } from '~/common/stores/chat/hooks/useFragmentBuckets';

import { isInlineHostedWebFragment } from '../fragments-content/BlockPartToolInvocation.utils';


export type ReasoningRenderSequenceItem =
  | { type: 'text'; key: string; text: string }
  | { type: 'hosted-web-group'; key: string; fragments: InterleavedFragment[] };


export function extractReasoningTitles(auxText: string): string[] {
  const titles: string[] = [];
  const seenTitles = new Set<string>();

  for (const rawLine of auxText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line)
      continue;

    const headingMatch = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    const boldOnlyMatch = !headingMatch ? line.match(/^(?:[-*]\s+)?\*\*(.+?)\*\*$/) : null;
    const htmlBoldOnlyMatch = !headingMatch && !boldOnlyMatch
      ? line.match(/^<p>\s*<strong>(.+?)<\/strong>\s*<\/p>$/i) ?? line.match(/^<strong>(.+?)<\/strong>$/i)
      : null;

    const title = (headingMatch?.[1] ?? boldOnlyMatch?.[1] ?? htmlBoldOnlyMatch?.[1] ?? '')
      .replace(/<\/?[^>]+>/g, '')
      .trim();

    if (!title || seenTitles.has(title))
      continue;

    seenTitles.add(title);
    titles.push(title);
  }

  return titles;
}

export function collapseReasoningFragments(fragments: readonly InterleavedFragment[]): InterleavedFragment[] {
  const reasoningFragments = fragments.filter(isVoidThinkingFragment);

  if (reasoningFragments.length <= 1)
    return [...fragments];

  const firstReasoningFragment = reasoningFragments[0];
  const mergedAuxText = reasoningFragments
    .map(fragment => fragment.part.aText.trim())
    .filter(Boolean)
    .join('\n\n');
  const mergedRedactedData = reasoningFragments.flatMap(fragment => fragment.part.redactedData ?? []);
  const mergedTextSignature = reasoningFragments.find(fragment => fragment.part.textSignature)?.part.textSignature;

  let mergedInserted = false;

  return fragments.flatMap(fragment => {
    const isReasoningFragment = isVoidThinkingFragment(fragment);

    if (!isReasoningFragment)
      return [fragment];

    if (fragment !== firstReasoningFragment)
      return [];

    mergedInserted = true;
    return [{
      ...fragment,
      part: {
        ...fragment.part,
        aText: mergedAuxText,
        ...(mergedTextSignature !== undefined ? { textSignature: mergedTextSignature } : {}),
        ...(mergedRedactedData.length ? { redactedData: mergedRedactedData } : {}),
      },
    }];
  }).filter(fragment => mergedInserted || fragment !== firstReasoningFragment);
}

export function extractReasoningRenderSequence(fragments: readonly InterleavedFragment[]): ReasoningRenderSequenceItem[] {
  const sequence: ReasoningRenderSequenceItem[] = [];
  let sawReasoning = false;
  let pendingHostedWebGroup: InterleavedFragment[] = [];

  const flushPendingHostedWebGroup = () => {
    if (!pendingHostedWebGroup.length)
      return;
    sequence.push({
      type: 'hosted-web-group',
      key: pendingHostedWebGroup[0].fId,
      fragments: pendingHostedWebGroup,
    });
    pendingHostedWebGroup = [];
  };

  for (const fragment of fragments) {
    const isReasoningFragment = isVoidThinkingFragment(fragment);

    if (isReasoningFragment) {
      flushPendingHostedWebGroup();
      sawReasoning = true;
      const text = fragment.part.aText.trim();
      if (!text)
        continue;

      const previousItem = sequence.at(-1);
      if (previousItem?.type === 'text') {
        previousItem.text = `${previousItem.text}\n\n${text}`;
      } else {
        sequence.push({
          type: 'text',
          key: fragment.fId,
          text,
        });
      }
      continue;
    }

    if (!sawReasoning)
      continue;

    if (isInlineHostedWebFragment(fragment)) {
      pendingHostedWebGroup.push(fragment);
      continue;
    }

    if (fragment.ft === 'content') {
      flushPendingHostedWebGroup();
      continue;
    }
  }

  flushPendingHostedWebGroup();

  return sequence;
}
