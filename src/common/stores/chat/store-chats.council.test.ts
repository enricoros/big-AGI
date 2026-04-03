import assert from 'node:assert/strict';
import test from 'node:test';

import { createCouncilSessionState } from '../../../apps/chat/editors/_handleExecute.council';
import { createCouncilOp } from '../../../apps/chat/editors/_handleExecute.council.log';
import { createDConversation } from './chat.conversation';
import { createDMessageTextContent } from './chat.message';
import { V4ToHeadConverters } from './chats.converters';
import { getConversationCouncilMaxRounds, useChatStore } from './store-chats';


test('council max rounds setter and getter sanitize persisted conversation values', () => {
  const conversation = createDConversation('Developer');
  Object.assign(conversation, { councilMaxRounds: -4 });
  useChatStore.setState({
    conversations: [conversation],
  });

  assert.equal(getConversationCouncilMaxRounds(conversation.id), 1);

  useChatStore.getState().setCouncilMaxRounds(conversation.id, 6.7);
  assert.equal(getConversationCouncilMaxRounds(conversation.id), 7);
});

test('council max rounds default to unlimited when unset', () => {
  const conversation = createDConversation('Developer');
  useChatStore.setState({
    conversations: [conversation],
  });

  assert.equal(getConversationCouncilMaxRounds(conversation.id), null);
});

test('council max rounds setter updates persisted resumable council workflow state and session_started op payload', () => {
  const conversation = createDConversation('Developer');
  conversation.councilMaxRounds = 4;
  conversation.councilSession = {
    status: 'interrupted',
    executeMode: 'generate-content',
    mode: 'council',
    phaseId: 'phase-1',
    passIndex: 0,
    workflowState: createCouncilSessionState({
      phaseId: 'phase-1',
      leaderParticipantId: 'leader',
      reviewerParticipantIds: ['critic'],
      maxRounds: 4,
    }),
    canResume: true,
    interruptionReason: 'page-unload',
    updatedAt: 100,
  };
  conversation.councilOpLog = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: 'leader',
      reviewerParticipantIds: ['critic'],
      maxRounds: 4,
      latestUserMessageId: 'user-1',
    }, {
      phaseId: 'phase-1',
      conversationId: conversation.id,
      createdAt: 100,
    }),
  ];

  useChatStore.setState({
    conversations: [conversation],
  });

  useChatStore.getState().setCouncilMaxRounds(conversation.id, 7);

  const updatedConversation = useChatStore.getState().conversations.find(item => item.id === conversation.id);
  assert.equal(updatedConversation?.councilMaxRounds, 7);
  assert.equal(updatedConversation?.councilSession?.workflowState?.maxRounds, 7);
  assert.equal(updatedConversation?.councilOpLog?.[0]?.type, 'session_started');
  assert.equal(updatedConversation?.councilOpLog?.[0]?.payload.maxRounds, 7);
});

test('legacy consensus conversation fields are normalized on hydration cleanup', () => {
  const conversation = createDConversation('Developer');
  const assistantMessage = createDMessageTextContent('assistant', 'Recovered deliberation');
  assistantMessage.metadata = {
    consensus: {
      kind: 'deliberation',
      phaseId: 'legacy-phase',
      passIndex: 2,
      action: 'proposal',
    },
  };

  Object.assign(conversation as unknown as Record<string, unknown>, {
    turnTerminationMode: 'consensus',
    consensusMaxRounds: '4',
    messages: [assistantMessage],
    councilSession: {
      status: 'interrupted',
      executeMode: 'generate-content',
      mode: 'consensus',
      phaseId: 'legacy-phase',
      passIndex: 2,
      workflowState: null,
      canResume: true,
      interruptionReason: 'page-unload',
      updatedAt: Date.now(),
    },
  });

  V4ToHeadConverters.inMemHeadCleanDConversations([conversation]);

  assert.equal(conversation.turnTerminationMode, 'council');
  assert.equal(conversation.councilMaxRounds, 4);
  assert.equal(conversation.councilSession?.mode, 'council');
  assert.deepStrictEqual(conversation.messages[0]?.metadata?.council, {
    kind: 'deliberation',
    phaseId: 'legacy-phase',
    passIndex: 2,
    action: 'proposal',
  });
  assert.equal('consensus' in (conversation.messages[0]?.metadata ?? {}), false);
});

test('hydration cleanup preserves completed and stopped council sessions', () => {
  const completedConversation = createDConversation('Developer');
  completedConversation.councilSession = {
    status: 'completed',
    executeMode: 'generate-content',
    mode: 'council',
    phaseId: 'phase-completed',
    passIndex: 1,
    workflowState: createCouncilSessionState({
      phaseId: 'phase-completed',
      leaderParticipantId: 'leader',
      reviewerParticipantIds: ['critic'],
      maxRounds: 4,
    }),
    canResume: false,
    interruptionReason: null,
    updatedAt: 100,
  };

  const stoppedConversation = createDConversation('Developer');
  stoppedConversation.councilSession = {
    status: 'stopped',
    executeMode: 'generate-content',
    mode: 'council',
    phaseId: 'phase-stopped',
    passIndex: 0,
    workflowState: createCouncilSessionState({
      phaseId: 'phase-stopped',
      leaderParticipantId: 'leader',
      reviewerParticipantIds: ['critic'],
      maxRounds: 4,
    }),
    canResume: false,
    interruptionReason: 'leader-invalid-proposal',
    updatedAt: 200,
  };

  V4ToHeadConverters.inMemHeadCleanDConversations([completedConversation, stoppedConversation]);

  assert.equal(completedConversation.councilSession?.status, 'completed');
  assert.equal(completedConversation.councilSession?.canResume, false);
  assert.equal(stoppedConversation.councilSession?.status, 'stopped');
  assert.equal(stoppedConversation.councilSession?.interruptionReason, 'leader-invalid-proposal');
});
