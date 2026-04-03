import assert from 'node:assert/strict';
import test from 'node:test';

import { ContentReassembler, normalizeCGIssueForDisplay } from './ContentReassembler';


test('normalizeCGIssueForDisplay sanitizes OpenAI input stream errors into a generic connection termination message', () => {
  const normalized = normalizeCGIssueForDisplay(
    'dispatch-read',
    '**[Streaming Issue] Openai**: Error in input stream',
  );

  assert.deepEqual(normalized, {
    issueText: 'An unexpected issue occurred: **connection terminated**.',
    issueHint: 'aix-net-disconnected',
  });
});

test('normalizeCGIssueForDisplay keeps unrelated issues unchanged', () => {
  const normalized = normalizeCGIssueForDisplay(
    'dispatch-parse',
    '**[Parsing Issue] Openai**: Something else happened',
  );

  assert.deepEqual(normalized, {
    issueText: '**[Parsing Issue] Openai**: Something else happened',
    issueHint: undefined,
  });
});

test('ContentReassembler persists function-call tool responses as content fragments', async () => {
  const reassembler = new ContentReassembler();
  reassembler.enqueueWireParticle({
    p: 'fcr',
    id: 'web-search-1',
    name: 'web_search',
    error: false,
    result: 'Query: canary islands saas',
    environment: 'upstream',
  });
  await reassembler.waitForWireComplete();

  const { accumulator } = reassembler;
  assert.equal(accumulator.fragments.length, 1);
  assert.deepEqual(accumulator.fragments[0]?.part, {
    pt: 'tool_response',
    id: 'web-search-1',
    error: false,
    response: {
      type: 'function_call',
      name: 'web_search',
      result: 'Query: canary islands saas',
    },
    environment: 'upstream',
  });
});
