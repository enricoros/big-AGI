import assert from 'node:assert/strict';
import test from 'node:test';

import {
  create_FunctionCallInvocation_ContentFragment,
  create_FunctionCallResponse_ContentFragment,
  createModelAuxVoidFragment,
  createTextContentFragment,
} from '~/common/stores/chat/chat.fragments';
import { createDMessageFromFragments } from '~/common/stores/chat/chat.message';

import { aixCGR_ChatSequence_FromDMessagesOrThrow } from './aix.client.chatGenerateRequest';


test('aixCGR_ChatSequence_FromDMessagesOrThrow accepts hosted upstream web tool responses with plain-text results', async () => {
  const assistantMessage = createDMessageFromFragments('assistant', [
    createModelAuxVoidFragment('reasoning', 'Need sources.'),
    create_FunctionCallInvocation_ContentFragment('ws-1', 'web_search', '{"q":"canary islands saas"}'),
    create_FunctionCallResponse_ContentFragment('ws-1', false, 'web_search', 'Hosted web search completed.', 'upstream'),
    createTextContentFragment('Final answer.'),
  ]);

  await assert.doesNotReject(async () => {
    const chatSequence = await aixCGR_ChatSequence_FromDMessagesOrThrow([assistantMessage]);
    assert.equal(chatSequence.length, 2);
  });
});
