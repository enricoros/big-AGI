import assert from 'node:assert/strict';
import test from 'node:test';

import type { ActileItem } from './ActileProvider';
import { filterMentionItems, getMentionItemHighlightParts, matchOpenMentionAtEnd } from './providerMentions.utils';


const mentionItems: ActileItem[] = [
  {
    key: 'all-agents',
    providerKey: 'pmention',
    label: '@all',
    description: 'Mention all agents',
  },
  {
    key: 'planner',
    providerKey: 'pmention',
    label: '@Planificador',
    description: 'Agent',
  },
  {
    key: 'devils-advocate',
    providerKey: 'pmention',
    label: '@Devil\'s Advocate',
    description: 'Agent',
  },
];

test('filterMentionItems keeps prefix matches ahead of weaker fuzzy matches', () => {
  assert.deepEqual(
    filterMentionItems(mentionItems, '@pla').map(item => item.label),
    ['@Planificador'],
  );
});

test('filterMentionItems matches abbreviated subsequences for agent names', () => {
  assert.deepEqual(
    filterMentionItems(mentionItems, '@pln').map(item => item.label),
    ['@Planificador'],
  );
});

test('filterMentionItems matches multi-word fuzzy queries against spaced names', () => {
  assert.deepEqual(
    filterMentionItems(mentionItems, '@dev adv').map(item => item.label),
    ['@Devil\'s Advocate'],
  );
});

test('filterMentionItems keeps @all pinned first when it matches', () => {
  assert.deepEqual(
    filterMentionItems(mentionItems, '@a').map(item => item.label),
    ['@all', '@Devil\'s Advocate', '@Planificador'],
  );
});

function serializeHighlight(label: string, search: string): string {
  return getMentionItemHighlightParts(label, search)
    .map(part => part.highlighted ? `[${part.text}]` : part.text)
    .join('');
}

test('getMentionItemHighlightParts highlights a direct prefix match as one range', () => {
  assert.equal(
    serializeHighlight('@Planificador', '@pla'),
    '[@Pla]nificador',
  );
});

test('getMentionItemHighlightParts highlights fuzzy subsequence matches without forcing a fake prefix', () => {
  assert.equal(
    serializeHighlight('@Planificador', '@pln'),
    '[@Pl]a[n]ificador',
  );
});

test('getMentionItemHighlightParts preserves separated fuzzy groups across words', () => {
  assert.equal(
    serializeHighlight('@Devil\'s Advocate', '@dev adv'),
    '[@Dev]il\'s [Adv]ocate',
  );
});

test('matchOpenMentionAtEnd keeps spaced mention names open while typing', () => {
  assert.equal(matchOpenMentionAtEnd('Ping @GPT 5.4')?.[0], ' @GPT 5.4');
  assert.equal(matchOpenMentionAtEnd('@Devil\'s Advocate')?.[0], '@Devil\'s Advocate');
  assert.equal(matchOpenMentionAtEnd('Ping @GPT 5.4\nnext line'), null);
});
