import assert from 'node:assert/strict';
import test from 'node:test';

import { create_FunctionCallInvocation_ContentFragment, create_FunctionCallResponse_ContentFragment, createTextContentFragment } from '~/common/stores/chat/chat.fragments';

import {
  getCompactInvocationDetails,
  groupInlineHostedWebFragments,
  isHostedWebToolName,
  isInlineHostedWebFragment,
} from './BlockPartToolInvocation.utils';


test('hosted web search tools are recognized', () => {
  assert.equal(isHostedWebToolName('web_search'), true);
  assert.equal(isHostedWebToolName('web_fetch'), true);
  assert.equal(isHostedWebToolName('custom_tool'), false);
});

test('web search invocation hides empty args and extracts query when present', () => {
  assert.deepEqual(getCompactInvocationDetails('web_search', ''), []);
  assert.deepEqual(getCompactInvocationDetails('web_search', '{"q":"canary islands saas"}'), [
    { label: 'Query', value: 'canary islands saas' },
  ]);
});

test('web fetch invocation extracts url when present', () => {
  assert.deepEqual(getCompactInvocationDetails('web_fetch', '{"url":"https://example.com"}'), [
    { label: 'URL', value: 'https://example.com' },
  ]);
});

test('hosted web invocation and upstream response are marked for inline grouping', () => {
  const invocation = create_FunctionCallInvocation_ContentFragment('tool-1', 'web_search', '{"q":"canarias"}');
  const response = create_FunctionCallResponse_ContentFragment('tool-1', false, 'web_search', 'Hosted web search completed.', 'upstream');

  assert.equal(isInlineHostedWebFragment(invocation), true);
  assert.equal(isInlineHostedWebFragment(response), true);
});

test('consecutive hosted web fragments are grouped into one inline row', () => {
  const fragments = [
    create_FunctionCallInvocation_ContentFragment('tool-1', 'web_search', '{"q":"canarias"}'),
    create_FunctionCallResponse_ContentFragment('tool-1', false, 'web_search', 'Hosted web search completed.', 'upstream'),
    createTextContentFragment('Result text'),
  ];

  const groups = groupInlineHostedWebFragments(fragments);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].inlineHostedWeb, true);
  assert.equal(groups[0].fragments.length, 2);
  assert.equal(groups[1].inlineHostedWeb, false);
  assert.equal(groups[1].fragments.length, 1);
});
