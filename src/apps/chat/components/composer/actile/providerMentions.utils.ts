import type { ActileItem } from './ActileProvider';


export function matchOpenMentionAtEnd(value: string): RegExpMatchArray | null {
  return value.match(/(^|\s)@[^@\n\r]*$/u);
}


function normalizeMentionSearchValue(value: string): string {
  return value
    .trim()
    .replace(/^@+/, '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function compactMentionSearchValue(value: string): string {
  return value.replace(/\s+/g, '');
}

function normalizeMentionSearchChars(value: string): string[] {
  return Array.from(
    value
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase(),
  ).filter(char => /[\p{L}\p{N}]/u.test(char));
}

function buildCompactLabelCharMap(label: string): { originalChars: string[]; compactEntries: { normalizedChar: string; originalIndex: number; }[]; } {
  const originalChars = Array.from(label);
  const compactEntries: { normalizedChar: string; originalIndex: number; }[] = [];

  originalChars.forEach((char, originalIndex) => {
    for (const normalizedChar of normalizeMentionSearchChars(char))
      compactEntries.push({ normalizedChar, originalIndex });
  });

  return { originalChars, compactEntries };
}

function getCompactMatchRange(compactEntries: { normalizedChar: string; originalIndex: number; }[], compactSearch: string): number[] | null {
  if (!compactSearch)
    return [];

  const compactLabel = compactEntries.map(entry => entry.normalizedChar).join('');
  const prefixIndex = compactLabel.indexOf(compactSearch);
  if (prefixIndex !== -1)
    return Array.from({ length: compactSearch.length }, (_, offset) => prefixIndex + offset);

  let compactIndex = 0;
  const matchedIndices: number[] = [];
  for (const searchChar of compactSearch) {
    const matchIndex = compactLabel.indexOf(searchChar, compactIndex);
    if (matchIndex === -1)
      return null;
    matchedIndices.push(matchIndex);
    compactIndex = matchIndex + 1;
  }

  return matchedIndices;
}

function getTokenPrefixMatchIndices(originalChars: string[], searchTokens: string[]): number[] | null {
  if (!searchTokens.length)
    return [];

  const labelTokens: { normalizedText: string; originalIndices: number[]; }[] = [];
  let currentToken: { normalizedText: string; originalIndices: number[]; } | null = null;

  for (let originalIndex = 0; originalIndex < originalChars.length; originalIndex++) {
    const char = originalChars[originalIndex]!;
    const normalizedChars = normalizeMentionSearchChars(char);

    if (normalizedChars.length) {
      currentToken ??= { normalizedText: '', originalIndices: [] };
      currentToken.normalizedText += normalizedChars.join('');
      currentToken.originalIndices.push(originalIndex);
      continue;
    }

    if (currentToken) {
      labelTokens.push(currentToken);
      currentToken = null;
    }
  }

  if (currentToken)
    labelTokens.push(currentToken);

  let tokenCursor = 0;
  const matchedOriginalIndices: number[] = [];

  for (const searchToken of searchTokens) {
    const matchingTokenIndex = labelTokens.findIndex((token, index) => index >= tokenCursor && token.normalizedText.startsWith(searchToken));
    if (matchingTokenIndex === -1)
      return null;

    const matchedToken = labelTokens[matchingTokenIndex]!;
    let coveredNormalizedChars = 0;
    for (const originalIndex of matchedToken.originalIndices) {
      matchedOriginalIndices.push(originalIndex);
      coveredNormalizedChars += normalizeMentionSearchChars(originalChars[originalIndex]!).length;
      if (coveredNormalizedChars >= searchToken.length)
        break;
    }

    tokenCursor = matchingTokenIndex + 1;
  }

  return matchedOriginalIndices;
}

export interface MentionHighlightPart {
  text: string;
  highlighted: boolean;
}

export function getMentionItemHighlightParts(label: string, rawSearch: string): MentionHighlightPart[] {
  const trimmedSearch = rawSearch.trim();
  const normalizedSearch = normalizeMentionSearchValue(rawSearch);
  const compactSearch = compactMentionSearchValue(normalizedSearch);
  const searchTokens = normalizedSearch.split(' ').filter(Boolean);
  const { originalChars, compactEntries } = buildCompactLabelCharMap(label);

  const highlightedOriginalIndices = new Set<number>();

  if (trimmedSearch.startsWith('@') && label.startsWith('@'))
    highlightedOriginalIndices.add(0);

  if (compactSearch) {
    const tokenPrefixMatchIndices = getTokenPrefixMatchIndices(originalChars, searchTokens);
    const compactMatchIndices = getCompactMatchRange(compactEntries, compactSearch);

    const selectedOriginalIndices = tokenPrefixMatchIndices?.length
      ? tokenPrefixMatchIndices
      : compactMatchIndices?.map(compactIndex => compactEntries[compactIndex]!.originalIndex) ?? [];

    for (const originalIndex of selectedOriginalIndices)
      highlightedOriginalIndices.add(originalIndex);
  }

  if (!originalChars.length)
    return [{ text: label, highlighted: false }];

  const parts: MentionHighlightPart[] = [];
  let currentHighlighted = highlightedOriginalIndices.has(0);
  let currentText = '';

  originalChars.forEach((char, index) => {
    const isHighlighted = highlightedOriginalIndices.has(index);
    if (index === 0) {
      currentHighlighted = isHighlighted;
      currentText = char;
      return;
    }

    if (isHighlighted === currentHighlighted) {
      currentText += char;
      return;
    }

    parts.push({ text: currentText, highlighted: currentHighlighted });
    currentHighlighted = isHighlighted;
    currentText = char;
  });

  parts.push({ text: currentText, highlighted: currentHighlighted });
  return parts.filter(part => part.text.length > 0);
}

function isCompactSubsequence(query: string, candidate: string): { matched: boolean; gapPenalty: number } {
  if (!query)
    return { matched: true, gapPenalty: 0 };

  let candidateIndex = 0;
  let gapPenalty = 0;

  for (const queryChar of query) {
    const matchIndex = candidate.indexOf(queryChar, candidateIndex);
    if (matchIndex === -1)
      return { matched: false, gapPenalty: Number.POSITIVE_INFINITY };

    gapPenalty += matchIndex - candidateIndex;
    candidateIndex = matchIndex + 1;
  }

  return { matched: true, gapPenalty };
}

const ALL_ITEM_EMPTY_SEARCH_SCORE = 10_000;
const DEFAULT_EMPTY_SEARCH_SCORE = 1_000;

// Exact matches should stay above every fuzzy variant, with @all still pinned first.
const ALL_ITEM_EXACT_MATCH_SCORE = 20_000;
const EXACT_MATCH_SCORE = 9_500;

// Direct prefixes outrank compact and token-prefix matches.
const ALL_ITEM_DIRECT_PREFIX_SCORE = 19_000;
const DIRECT_PREFIX_SCORE = 9_000;

// Compact prefixes are slightly weaker than direct prefixes because they ignore separators.
const COMPACT_PREFIX_SCORE = 8_500;

// Token-prefix matching is stronger than generic containment and subsequence matching.
const ALL_ITEM_TOKEN_PREFIX_BASE_SCORE = 18_000;
const TOKEN_PREFIX_BASE_SCORE = 8_000;
const TOKEN_PREFIX_TOKEN_MATCH_SCORE = 120;
const TOKEN_PREFIX_CURSOR_GAP_PENALTY = 6;

// Containment and subsequence matches are the weakest accepted fuzzy matches.
const COMPACT_CONTAINS_BASE_SCORE = 7_000;
const SUBSEQUENCE_BASE_SCORE = 6_000;
const COMPACT_POSITION_PENALTY = 8;
const SUBSEQUENCE_GAP_PENALTY = 8;

function getMentionItemScore(item: ActileItem, rawSearch: string): number | null {
  const normalizedSearch = normalizeMentionSearchValue(rawSearch);
  if (!normalizedSearch)
    return item.label === '@all' ? ALL_ITEM_EMPTY_SEARCH_SCORE : DEFAULT_EMPTY_SEARCH_SCORE;

  const normalizedLabel = normalizeMentionSearchValue(item.label);
  if (!normalizedLabel)
    return null;

  const compactSearch = compactMentionSearchValue(normalizedSearch);
  const compactLabel = compactMentionSearchValue(normalizedLabel);
  const searchTokens = normalizedSearch.split(' ').filter(Boolean);
  const labelTokens = normalizedLabel.split(' ').filter(Boolean);

  const isAllItem = item.label === '@all';
  const isExact = normalizedLabel === normalizedSearch;
  if (isExact)
    return isAllItem ? ALL_ITEM_EXACT_MATCH_SCORE : EXACT_MATCH_SCORE;

  const isDirectPrefix = normalizedLabel.startsWith(normalizedSearch);
  if (isDirectPrefix)
    return (isAllItem ? ALL_ITEM_DIRECT_PREFIX_SCORE : DIRECT_PREFIX_SCORE) - (normalizedLabel.length - normalizedSearch.length);

  const isCompactPrefix = compactLabel.startsWith(compactSearch);
  if (isCompactPrefix)
    return COMPACT_PREFIX_SCORE - (compactLabel.length - compactSearch.length);

  let tokenCursor = 0;
  let tokenPrefixScore = 0;
  for (const searchToken of searchTokens) {
    const matchingTokenIndex = labelTokens.findIndex((labelToken, index) => index >= tokenCursor && labelToken.startsWith(searchToken));
    if (matchingTokenIndex === -1) {
      tokenPrefixScore = -1;
      break;
    }

    tokenPrefixScore += TOKEN_PREFIX_TOKEN_MATCH_SCORE
      - (labelTokens[matchingTokenIndex]!.length - searchToken.length)
      - (matchingTokenIndex - tokenCursor) * TOKEN_PREFIX_CURSOR_GAP_PENALTY;
    tokenCursor = matchingTokenIndex + 1;
  }
  if (tokenPrefixScore >= 0)
    return (isAllItem ? ALL_ITEM_TOKEN_PREFIX_BASE_SCORE : TOKEN_PREFIX_BASE_SCORE) + tokenPrefixScore;

  const compactContainsIndex = compactLabel.indexOf(compactSearch);
  if (compactContainsIndex !== -1)
    return COMPACT_CONTAINS_BASE_SCORE
      - compactContainsIndex * COMPACT_POSITION_PENALTY
      - (compactLabel.length - compactSearch.length);

  const subsequence = isCompactSubsequence(compactSearch, compactLabel);
  if (subsequence.matched)
    return SUBSEQUENCE_BASE_SCORE
      - subsequence.gapPenalty * SUBSEQUENCE_GAP_PENALTY
      - (compactLabel.length - compactSearch.length);

  return null;
}

export function filterMentionItems<TItem extends ActileItem>(items: TItem[], rawSearch: string): TItem[] {
  return items
    .map((item, index) => ({ item, index, score: getMentionItemScore(item, rawSearch) }))
    .filter((entry): entry is { item: TItem; index: number; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.item);
}
