import assert from 'node:assert/strict';
import test from 'node:test';

import type { DMessage } from '~/common/stores/chat/chat.message';

import type { AixChatGenerateContent_DMessageGuts } from '~/modules/aix/client/aix.client';

import { shouldForcePersonaStreamFlush } from './chat-persona';


function createStreamUpdate(responseId?: string | null): AixChatGenerateContent_DMessageGuts {
  return {
    fragments: [],
    generator: {
      mgt: 'named',
      name: 'test-model',
      ...(responseId ? {
        upstreamHandle: {
          uht: 'vnd.oai.responses',
          responseId,
          expiresAt: null,
        },
      } : {}),
    },
    pendingIncomplete: true,
  };
}

function createExistingMessage(responseId?: string | null): DMessage {
  return {
    id: 'msg_test_existing',
    role: 'assistant',
    created: 0,
    updated: null,
    fragments: [],
    generator: {
      mgt: 'named',
      name: 'test-model',
      ...(responseId ? {
        upstreamHandle: {
          uht: 'vnd.oai.responses',
          responseId,
          expiresAt: null,
        },
      } : {}),
    },
  };
}

test('shouldForcePersonaStreamFlush forces a write when a new upstream handle first appears', () => {
  assert.equal(shouldForcePersonaStreamFlush({
    existingMessage: createExistingMessage(),
    pendingUpdate: null,
    nextUpdate: createStreamUpdate('resp_123'),
    messageComplete: false,
  }), true);
});

test('shouldForcePersonaStreamFlush does not force another write for the same upstream handle', () => {
  assert.equal(shouldForcePersonaStreamFlush({
    existingMessage: createExistingMessage('resp_123'),
    pendingUpdate: createStreamUpdate('resp_123'),
    nextUpdate: createStreamUpdate('resp_123'),
    messageComplete: false,
  }), false);
});

test('shouldForcePersonaStreamFlush still forces completion writes', () => {
  assert.equal(shouldForcePersonaStreamFlush({
    existingMessage: createExistingMessage('resp_123'),
    pendingUpdate: createStreamUpdate('resp_123'),
    nextUpdate: createStreamUpdate('resp_123'),
    messageComplete: true,
  }), true);
});
