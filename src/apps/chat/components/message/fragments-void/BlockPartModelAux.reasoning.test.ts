import assert from 'node:assert/strict';
import test from 'node:test';

import {
  create_FunctionCallInvocation_ContentFragment,
  create_FunctionCallResponse_ContentFragment,
  createModelAuxVoidFragment,
  createTextContentFragment,
} from '~/common/stores/chat/chat.fragments';

import { collapseReasoningFragments, extractReasoningRenderSequence, extractReasoningTitles } from './BlockPartModelAux.reasoning';


test('extractReasoningTitles returns streamed markdown and html-only titles in order', () => {
  assert.deepEqual(
    extractReasoningTitles([
      '**Researching SaaS business ideas**',
      '',
      'Checking pricing patterns and distribution channels.',
      '',
      '## Comparing niches',
      '<p><strong>Researching SaaS business ideas</strong></p>',
      '<p><strong>Validating demand</strong></p>',
    ].join('\n')),
    [
      'Researching SaaS business ideas',
      'Comparing niches',
      'Validating demand',
    ],
  );
});

test('extractReasoningTitles does not truncate long title streams', () => {
  assert.deepEqual(
    extractReasoningTitles([
      '**One**',
      '**Two**',
      '**Three**',
      '**Four**',
      '**Five**',
      '**Six**',
      '**Seven**',
      '**Eight**',
      '**Nine**',
    ].join('\n')),
    [
      'One',
      'Two',
      'Three',
      'Four',
      'Five',
      'Six',
      'Seven',
      'Eight',
      'Nine',
    ],
  );
});

test('extractReasoningTitles remains unbounded for long reasoning title streams', () => {
  const titles = Array.from({ length: 20 }, (_, index) => `Step ${index + 1}`);

  assert.deepEqual(
    extractReasoningTitles(titles.map(title => `**${title}**`).join('\n')),
    titles,
  );
});

test('collapseReasoningFragments merges multiple reasoning fragments into one per message', () => {
  const fragments = [
    createModelAuxVoidFragment('reasoning', '**Planning**'),
    createTextContentFragment('Visible output'),
    createModelAuxVoidFragment('reasoning', '**Checking**'),
  ];

  const collapsed = collapseReasoningFragments(fragments);

  assert.equal(collapsed.filter(fragment =>
    fragment.ft === 'void'
    && fragment.part.pt === 'ma'
    && fragment.part.aType === 'reasoning',
  ).length, 1);
  assert.equal(collapsed.length, 2);
  assert.match(
    collapsed[0].ft === 'void' && collapsed[0].part.pt === 'ma' ? collapsed[0].part.aText : '',
    /\*\*Planning\*\*[\s\S]*\*\*Checking\*\*/,
  );
});

test('extractReasoningRenderSequence groups consecutive hosted web fragments into a single inline item', () => {
  const sequence = extractReasoningRenderSequence([
    createModelAuxVoidFragment('reasoning', 'Need sources.'),
    create_FunctionCallInvocation_ContentFragment('ws-1', 'web_search', '{"q":"canary islands saas"}'),
    create_FunctionCallResponse_ContentFragment('ws-1', false, 'web_search', 'Hosted web search completed.', 'upstream'),
    createTextContentFragment('Final answer.'),
  ]);

  assert.equal(sequence.length, 2);
  assert.equal(sequence[0]?.type, 'text');
  assert.equal(sequence[1]?.type, 'hosted-web-group');
  assert.equal(sequence[1]?.type === 'hosted-web-group' ? sequence[1].fragments.length : 0, 2);
});

test('extractReasoningRenderSequence keeps hosted web fragments inside reasoning after visible text appears', () => {
  const sequence = extractReasoningRenderSequence([
    createModelAuxVoidFragment('reasoning', 'Need sources.'),
    createTextContentFragment('Drafting final answer.'),
    create_FunctionCallInvocation_ContentFragment('ws-1', 'web_search', '{"q":"canary islands saas"}'),
    create_FunctionCallResponse_ContentFragment('ws-1', false, 'web_search', 'Hosted web search completed.', 'upstream'),
    createTextContentFragment('Final answer.'),
  ]);

  assert.equal(sequence.length, 2);
  assert.equal(sequence[0]?.type, 'text');
  assert.equal(sequence[1]?.type, 'hosted-web-group');
  assert.equal(sequence[1]?.type === 'hosted-web-group' ? sequence[1].fragments.length : 0, 2);
});
