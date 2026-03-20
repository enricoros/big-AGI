import assert from 'node:assert/strict';
import test from 'node:test';

import {
  create_FunctionCallInvocation_ContentFragment,
  create_FunctionCallResponse_ContentFragment,
  createTextContentFragment,
} from '~/common/stores/chat/chat.fragments';
import { createDMessageFromFragments } from '~/common/stores/chat/chat.message';
import { aixCGR_ChatSequence_FromDMessagesOrThrow } from '~/modules/aix/client/aix.client.chatGenerateRequest';

import { aixToOpenAIResponses } from './openai.responsesCreate';


test('OpenAI Responses does not replay hosted upstream web-search tool history as function call items', async () => {
  const assistantMessage = createDMessageFromFragments('assistant', [
    create_FunctionCallInvocation_ContentFragment('ws-1', 'web_search', '{"q":"canary islands saas"}'),
    create_FunctionCallResponse_ContentFragment('ws-1', false, 'web_search', 'Hosted web search completed.', 'upstream'),
    createTextContentFragment('Final answer.'),
  ]);

  const chatSequence = await aixCGR_ChatSequence_FromDMessagesOrThrow([assistantMessage]);
  const payload = aixToOpenAIResponses(
    'openai',
    { id: 'gpt-5.4' } as any,
    { systemMessage: null, chatSequence },
    false,
    false,
  );

  assert.ok(Array.isArray(payload.input));
  assert.equal(payload.input.some(item => item.type === 'function_call' && item.call_id === 'ws-1'), false);
  assert.equal(payload.input.some(item => item.type === 'function_call_output' && item.call_id === 'ws-1'), false);
  assert.ok(payload.input.some(item =>
    item.type === 'message'
    && item.role === 'assistant'
    && item.content.some(content => content.type === 'output_text' && content.text.includes('Final answer.')),
  ));
});

test('OpenAI Responses does not replay incomplete hosted upstream web-search invocations without tool output', async () => {
  const assistantMessage = createDMessageFromFragments('assistant', [
    create_FunctionCallInvocation_ContentFragment('ws-2', 'web_search', '{"q":"used scooters tenerife"}'),
    createTextContentFragment('Searching for current prices'),
  ]);

  const chatSequence = await aixCGR_ChatSequence_FromDMessagesOrThrow([assistantMessage]);
  const payload = aixToOpenAIResponses(
    'openai',
    { id: 'gpt-5.4' } as any,
    { systemMessage: null, chatSequence },
    false,
    false,
  );

  assert.equal(payload.input.some(item => item.type === 'function_call' && item.call_id === 'ws-2'), false);
});

test('OpenAI Responses still replays regular function-call history', async () => {
  const assistantMessage = createDMessageFromFragments('assistant', [
    create_FunctionCallInvocation_ContentFragment('tool-1', 'lookup_price', '{"item":"bike"}'),
    create_FunctionCallResponse_ContentFragment('tool-1', false, 'lookup_price', '{"price":1200}', 'client'),
    createTextContentFragment('The bike costs 1200.'),
  ]);

  const chatSequence = await aixCGR_ChatSequence_FromDMessagesOrThrow([assistantMessage]);
  const payload = aixToOpenAIResponses(
    'openai',
    { id: 'gpt-5.4' } as any,
    { systemMessage: null, chatSequence },
    false,
    false,
  );

  assert.equal(payload.input.some(item => item.type === 'function_call' && item.call_id === 'tool-1'), true);
  assert.equal(payload.input.some(item => item.type === 'function_call_output' && item.call_id === 'tool-1'), true);
});

test('OpenAI Responses enables stored upstream state only when resumability is requested', () => {
  const resumablePayload = aixToOpenAIResponses(
    'openai',
    { id: 'gpt-5.4' } as any,
    { systemMessage: null, chatSequence: [] },
    false,
    true,
  );
  const nonResumablePayload = aixToOpenAIResponses(
    'openai',
    { id: 'gpt-5.4' } as any,
    { systemMessage: null, chatSequence: [] },
    false,
    false,
  );

  assert.equal(resumablePayload.store, true);
  assert.equal(nonResumablePayload.store, false);
});
