import assert from 'node:assert/strict';
import test from 'node:test';

import { focusNotificationTargetTab, getBackgroundChatCompletionSnackbar, getMessageCompletionNotification, inferResumableCouncilSession, openConversationFromCompletionNotification, shouldShowSystemNotification } from './ConversationHandler';
import { createDConversation, createAssistantConversationParticipant, createHumanConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { createDMessagePlaceholderIncomplete, createDMessageTextContent } from '~/common/stores/chat/chat.message';
import { createCouncilSessionState } from '../../apps/chat/editors/_handleExecute.council';
import { createCouncilOp } from '../../apps/chat/editors/_handleExecute.council.log';
import { getFocusedPaneConversationId, panesManagerActions } from '../../apps/chat/components/panes/store-panes-manager';
import { useModelsStore } from '~/common/stores/llms/store-llms';
import type { DLLM } from '~/common/stores/llms/llms.types';


const TEST_LLM_ID = 'test-llm';

useModelsStore.setState(state => ({
  ...state,
  llms: [{
    id: TEST_LLM_ID,
    label: 'Test LLM',
    created: 0,
    description: 'Test model',
    hidden: false,
    contextTokens: 8192,
    maxOutputTokens: 4096,
    interfaces: ['oai-chat', 'oai-chat-reasoning'],
    parameterSpecs: [],
    initialParameters: {
      llmRef: TEST_LLM_ID,
      llmTemperature: 0.5,
      llmResponseTokens: 1024,
    },
    sId: 'test-service',
    vId: 'openai',
    userParameters: {
      llmRef: TEST_LLM_ID,
    },
  } satisfies DLLM],
  sources: [{
    id: 'test-service',
    label: 'Test Service',
    vId: 'openai',
    setup: {
      oaiKey: 'test-key',
      oaiOrg: '',
      oaiHost: '',
      heliKey: '',
    },
  }],
}));

function completeMessage<T extends ReturnType<typeof createDMessageTextContent>>(message: T): T {
  message.updated = message.created;
  return message;
}

function createCouncilConversation() {
  const conversation = createDConversation('Developer');
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic');
  const writer = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Writer');
  conversation.participants = [human, leader, critic, writer];
  conversation.turnTerminationMode = 'council';
  return { conversation, human, leader, critic, writer };
}

test('inferResumableCouncilSession rehydrates a completed council trace from councilOpLog', () => {
  const { conversation, human, leader, critic, writer } = createCouncilConversation();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  conversation.messages = [userMessage];

  const phaseId = 'phase-completed-refresh';
  const councilOpLog = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: leader.id,
      reviewerParticipantIds: [critic.id, writer.id],
      maxRounds: 12,
      latestUserMessageId: userMessage.id,
    }, {
      phaseId,
      conversationId: conversation.id,
      opId: 'session-start',
      createdAt: 100,
    }),
  ];

  councilOpLog.push(createCouncilOp(councilOpLog, 'leader_turn_committed', {
    roundIndex: 0,
    participantId: leader.id,
    proposalId: 'proposal-1',
    proposalText: 'Draft one.',
    deliberationText: '',
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: conversation.id,
    opId: 'leader-turn',
    createdAt: 101,
  }));

  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_vote_committed', {
    roundIndex: 0,
    participantId: critic.id,
    decision: 'accept',
    reason: null,
    fragmentTexts: ['Looks good.'],
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: conversation.id,
    opId: 'critic-vote',
    createdAt: 102,
  }));

  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_vote_committed', {
    roundIndex: 0,
    participantId: writer.id,
    decision: 'accept',
    reason: null,
    fragmentTexts: ['Shippable.'],
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: conversation.id,
    opId: 'writer-vote',
    createdAt: 103,
  }));

  councilOpLog.push(createCouncilOp(councilOpLog, 'round_completed', {
    roundIndex: 0,
    outcome: 'accepted',
    rejectionReasons: [],
  }, {
    phaseId,
    conversationId: conversation.id,
    opId: 'round-complete',
    createdAt: 104,
  }));

  councilOpLog.push(createCouncilOp(councilOpLog, 'session_accepted', {
    roundIndex: 0,
    proposalId: 'proposal-1',
    finalResponse: 'Draft one.',
  }, {
    phaseId,
    conversationId: conversation.id,
    opId: 'session-accepted',
    createdAt: 105,
  }));

  conversation.councilOpLog = councilOpLog;
  const inferred = inferResumableCouncilSession(conversation);

  assert.ok(inferred);
  assert.equal(inferred?.status, 'completed');
  assert.equal(inferred?.canResume, false);
  assert.equal(inferred?.phaseId, phaseId);
  assert.equal(inferred?.workflowState?.status, 'accepted');
  assert.equal(inferred?.workflowState?.finalResponse, 'Draft one.');
});

test('inferResumableCouncilSession rehydrates a stopped council trace from councilOpLog', () => {
  const { conversation, human, leader, critic, writer } = createCouncilConversation();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  conversation.messages = [userMessage];

  const phaseId = 'phase-stopped-refresh';
  const councilOpLog = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: leader.id,
      reviewerParticipantIds: [critic.id, writer.id],
      maxRounds: 12,
      latestUserMessageId: userMessage.id,
    }, {
      phaseId,
      conversationId: conversation.id,
      opId: 'session-start',
      createdAt: 100,
    }),
  ];

  councilOpLog.push(createCouncilOp(councilOpLog, 'leader_turn_committed', {
    roundIndex: 0,
    participantId: leader.id,
    proposalId: 'proposal-1',
    proposalText: 'Draft one.',
    deliberationText: '',
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: conversation.id,
    opId: 'leader-turn',
    createdAt: 101,
  }));

  councilOpLog.push(createCouncilOp(councilOpLog, 'session_stopped', {
    reason: '@stop',
  }, {
    phaseId,
    conversationId: conversation.id,
    opId: 'session-stopped',
    createdAt: 102,
  }));

  conversation.councilOpLog = councilOpLog;
  const inferred = inferResumableCouncilSession(conversation);

  assert.ok(inferred);
  assert.equal(inferred?.status, 'stopped');
  assert.equal(inferred?.canResume, true);
  assert.equal(inferred?.phaseId, phaseId);
  assert.equal(inferred?.interruptionReason, '@stop');
  assert.equal(inferred?.workflowState?.rounds[0]?.proposalText, 'Draft one.');
});

test('inferResumableCouncilSession keeps fatal stopped council traces non-resumable', () => {
  const { conversation, leader } = createCouncilConversation();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  conversation.messages = [userMessage];

  const phaseId = 'phase-fatal-stop-refresh';
  const councilOpLog = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: leader.id,
      reviewerParticipantIds: [],
      maxRounds: 12,
      latestUserMessageId: userMessage.id,
    }, {
      phaseId,
      conversationId: conversation.id,
      opId: 'session-start',
      createdAt: 100,
    }),
  ];

  councilOpLog.push(createCouncilOp(councilOpLog, 'leader_turn_committed', {
    roundIndex: 0,
    participantId: leader.id,
    proposalId: 'proposal-1',
    proposalText: 'Draft one.',
    deliberationText: '',
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: conversation.id,
    opId: 'leader-turn',
    createdAt: 101,
  }));

  councilOpLog.push(createCouncilOp(councilOpLog, 'session_stopped', {
    reason: 'leader-invalid-proposal',
  }, {
    phaseId,
    conversationId: conversation.id,
    opId: 'session-stopped',
    createdAt: 102,
  }));

  conversation.councilOpLog = councilOpLog;
  const inferred = inferResumableCouncilSession(conversation);

  assert.ok(inferred);
  assert.equal(inferred?.status, 'stopped');
  assert.equal(inferred?.canResume, false);
  assert.equal(inferred?.phaseId, phaseId);
  assert.equal(inferred?.interruptionReason, 'leader-invalid-proposal');
});

test('inferResumableCouncilSession falls back to a persisted resumable council checkpoint when the council log is missing after refresh', () => {
  const { conversation, leader, critic, writer } = createCouncilConversation();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  conversation.messages = [userMessage];

  const workflowState = createCouncilSessionState({
    phaseId: 'phase-persisted-refresh',
    leaderParticipantId: leader.id,
    reviewerParticipantIds: [critic.id, writer.id],
    maxRounds: 12,
  });

  conversation.councilSession = {
    status: 'interrupted',
    executeMode: 'generate-content',
    mode: 'council',
    phaseId: workflowState.phaseId,
    passIndex: workflowState.roundIndex,
    workflowState,
    canResume: true,
    interruptionReason: 'page-unload',
    updatedAt: userMessage.created + 1,
  };

  const inferred = inferResumableCouncilSession(conversation);

  assert.ok(inferred);
  assert.equal(inferred?.status, 'interrupted');
  assert.equal(inferred?.canResume, true);
  assert.equal(inferred?.phaseId, workflowState.phaseId);
  assert.equal(inferred?.workflowState?.status, 'drafting');
  assert.equal(inferred?.interruptionReason, 'page-unload');
});

test('inferResumableCouncilSession keeps a completed council trace from a persisted checkpoint when the council log is missing after refresh', () => {
  const { conversation, leader, critic, writer } = createCouncilConversation();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  conversation.messages = [userMessage];

  const workflowState = createCouncilSessionState({
    phaseId: 'phase-persisted-completed-refresh',
    leaderParticipantId: leader.id,
    reviewerParticipantIds: [critic.id, writer.id],
    maxRounds: 12,
  });
  workflowState.status = 'accepted';
  workflowState.acceptedProposalId = 'proposal-1';
  workflowState.finalResponse = 'Draft one.';
  workflowState.rounds[0].proposalId = 'proposal-1';
  workflowState.rounds[0].proposalText = 'Draft one.';

  conversation.councilSession = {
    status: 'completed',
    executeMode: 'generate-content',
    mode: 'council',
    phaseId: workflowState.phaseId,
    passIndex: workflowState.roundIndex,
    workflowState,
    canResume: false,
    interruptionReason: null,
    updatedAt: userMessage.created + 1,
  };

  const inferred = inferResumableCouncilSession(conversation);

  assert.ok(inferred);
  assert.equal(inferred?.status, 'completed');
  assert.equal(inferred?.canResume, false);
  assert.equal(inferred?.phaseId, workflowState.phaseId);
  assert.equal(inferred?.workflowState?.status, 'accepted');
  assert.equal(inferred?.workflowState?.finalResponse, 'Draft one.');
});

test('getMessageCompletionNotification reports when a normal assistant reply finishes', () => {
  const conversation = createDConversation('Developer');
  const previousConversation = structuredClone(conversation);
  const assistantMessage = completeMessage(createDMessageTextContent('assistant', 'Done.'));

  conversation.messages = [assistantMessage];

  const notification = getMessageCompletionNotification(previousConversation, conversation);

  assert.deepEqual(notification, {
    conversationId: conversation.id,
    title: 'New reply ready.',
    body: 'Done.',
    tag: `message-complete:${conversation.id}:${assistantMessage.id}`,
  });
});

test('getMessageCompletionNotification reports when a council result reply finishes', () => {
  const { conversation, leader, critic, writer } = createCouncilConversation();
  const previousConversation = structuredClone(conversation);

  const resultMessage = completeMessage(createDMessageTextContent('assistant', 'Draft one.'));
  resultMessage.metadata = {
    author: {
      participantId: leader.id,
      participantName: leader.name,
      personaId: leader.personaId,
      llmId: leader.llmId,
    },
    council: {
      kind: 'result',
      phaseId: 'phase-final-response-notification',
      passIndex: 0,
      leaderParticipantId: leader.id,
    },
  };
  conversation.messages = [resultMessage];

  const notification = getMessageCompletionNotification(previousConversation, conversation);

  assert.deepEqual(notification, {
    conversationId: conversation.id,
    title: 'Leader replied.',
    body: 'Draft one.',
    tag: `message-complete:${conversation.id}:${resultMessage.id}`,
  });
});

test('getMessageCompletionNotification ignores council deliberation messages', () => {
  const { conversation, leader, critic, writer } = createCouncilConversation();
  const previousConversation = structuredClone(conversation);

  const deliberationMessage = completeMessage(createDMessageTextContent('assistant', 'Internal draft one.'));
  deliberationMessage.metadata = {
    author: {
      participantId: critic.id,
      participantName: critic.name,
      personaId: critic.personaId,
      llmId: critic.llmId,
    },
    council: {
      kind: 'deliberation',
      phaseId: 'phase-no-deliberation-notification',
      passIndex: 0,
      action: 'accept',
      leaderParticipantId: leader.id,
    },
  };
  conversation.messages = [deliberationMessage];

  assert.equal(getMessageCompletionNotification(previousConversation, conversation), null);
});

test('getMessageCompletionNotification ignores initial hydration', () => {
  const conversation = createDConversation('Developer');
  const assistantMessage = completeMessage(createDMessageTextContent('assistant', 'Done.'));
  conversation.messages = [assistantMessage];

  assert.equal(getMessageCompletionNotification(null, conversation), null);
});

test('getBackgroundChatCompletionSnackbar targets non-focused chats and opens them on click', () => {
  panesManagerActions().openConversationInFocusedPane('focused-chat');

  const conversation = createDConversation('Developer');
  conversation.autoTitle = 'Background Council';

  const snackbar = getBackgroundChatCompletionSnackbar({
    conversationId: conversation.id,
    title: 'Leader replied.',
    body: 'Draft one.',
    tag: `message-complete:${conversation.id}:msg-1`,
  }, conversation);

  assert.ok(snackbar);
  assert.equal(snackbar?.message, 'Background Council replied.');
  assert.equal(typeof snackbar?.onClick, 'function');

  snackbar?.onClick?.();
  assert.equal(getFocusedPaneConversationId(), conversation.id);
});

test('focusNotificationTargetTab brings the current app tab to the front', () => {
  const originalWindow = globalThis.window;
  const focusCalls: string[] = [];
  const openCalls: Array<[string, string]> = [];

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      focus: () => {
        focusCalls.push('focus');
      },
      open: (url: string, target: string) => {
        openCalls.push([url, target]);
        return {
          focus: () => {
            focusCalls.push('open-focus');
          },
        };
      },
    },
  });

  focusNotificationTargetTab();

  assert.deepEqual(focusCalls, ['focus', 'open-focus']);
  assert.deepEqual(openCalls, [['', '_self']]);

  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
});

test('openConversationFromCompletionNotification focuses the app tab and opens the target chat', () => {
  const originalWindow = globalThis.window;
  const focusCalls: string[] = [];
  const openCalls: Array<[string, string]> = [];

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      focus: () => {
        focusCalls.push('focus');
      },
      open: (url: string, target: string) => {
        openCalls.push([url, target]);
        return {
          focus: () => {
            focusCalls.push('open-focus');
          },
        };
      },
    },
  });

  openConversationFromCompletionNotification('notification-target-chat');

  assert.deepEqual(focusCalls, ['focus', 'open-focus']);
  assert.deepEqual(openCalls, [['', '_self']]);
  assert.equal(getFocusedPaneConversationId(), 'notification-target-chat');

  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
});

test('shouldShowSystemNotification is false while the app window is active', () => {
  const originalDocument = globalThis.document;
  const originalNotification = globalThis.Notification;

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      visibilityState: 'visible',
      hasFocus: () => true,
    },
  });
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: { permission: 'granted' },
  });

  assert.equal(shouldShowSystemNotification(), false);

  Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
  Object.defineProperty(globalThis, 'Notification', { configurable: true, value: originalNotification });
});

test('inferResumableCouncilSession ignores a completed councilOpLog after a newer user turn', () => {
  const { conversation, leader, critic, writer } = createCouncilConversation();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Original request.'));
  const newerUserMessage = completeMessage(createDMessageTextContent('user', 'Newer request.'));
  conversation.messages = [userMessage, newerUserMessage];

  const phaseId = 'phase-stale-completed';
  const councilOpLog = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: leader.id,
      reviewerParticipantIds: [critic.id, writer.id],
      maxRounds: 12,
      latestUserMessageId: userMessage.id,
    }, {
      phaseId,
      conversationId: conversation.id,
      opId: 'session-start',
      createdAt: 100,
    }),
  ];

  councilOpLog.push(createCouncilOp(councilOpLog, 'leader_turn_committed', {
    roundIndex: 0,
    participantId: leader.id,
    proposalId: 'proposal-1',
    proposalText: 'Draft one.',
    deliberationText: '',
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: conversation.id,
    opId: 'leader-turn',
    createdAt: 101,
  }));

  councilOpLog.push(createCouncilOp(councilOpLog, 'session_accepted', {
    roundIndex: 0,
    proposalId: 'proposal-1',
    finalResponse: 'Draft one.',
  }, {
    phaseId,
    conversationId: conversation.id,
    opId: 'session-accepted',
    createdAt: 102,
  }));

  conversation.councilOpLog = councilOpLog;

  assert.equal(inferResumableCouncilSession(conversation), null);
});

test('inferResumableCouncilSession does not expose resume for a completed human-driven turn', () => {
  const conversation = createDConversation('Developer');
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic', 'when-mentioned');
  conversation.participants = [human, leader, critic];
  conversation.turnTerminationMode = 'round-robin-per-human';

  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer plainly.'));
  const leaderMessage = completeMessage(createDMessageTextContent('assistant', 'Done.'));
  leaderMessage.metadata = {
    author: {
      participantId: leader.id,
      participantName: leader.name,
      personaId: leader.personaId,
      llmId: leader.llmId,
    },
  };
  conversation.messages = [userMessage, leaderMessage];
  conversation.councilSession = {
    status: 'interrupted',
    executeMode: 'generate-content',
    mode: 'round-robin-per-human',
    phaseId: null,
    passIndex: 0,
    workflowState: null,
    canResume: true,
    interruptionReason: 'page-unload',
    updatedAt: Date.now(),
  };

  assert.equal(inferResumableCouncilSession(conversation), null);
});

test('inferResumableCouncilSession exposes room resume for an incomplete assistant message', () => {
  const conversation = createDConversation('Developer');
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic');
  conversation.participants = [human, leader, critic];
  conversation.turnTerminationMode = 'round-robin-per-human';

  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer plainly.'));
  const incompleteLeaderMessage = createDMessagePlaceholderIncomplete('assistant', '...');
  incompleteLeaderMessage.metadata = {
    author: {
      participantId: leader.id,
      participantName: leader.name,
      personaId: leader.personaId,
      llmId: leader.llmId,
    },
  };
  conversation.messages = [userMessage, incompleteLeaderMessage];

  const inferred = inferResumableCouncilSession(conversation);
  assert.ok(inferred);
  assert.equal(inferred?.mode, 'round-robin-per-human');
  assert.equal(inferred?.status, 'interrupted');
  assert.equal(inferred?.canResume, true);
});

test('inferResumableCouncilSession exposes room resume for an incomplete single-assistant message', () => {
  const conversation = createDConversation('Developer');
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Nova Yield', 'every-turn', true);
  conversation.participants = [human, leader];
  conversation.turnTerminationMode = 'round-robin-per-human';

  const userMessage = completeMessage(createDMessageTextContent('user', 'Find me transport options.'));
  const incompleteLeaderMessage = createDMessagePlaceholderIncomplete('assistant', '...');
  incompleteLeaderMessage.metadata = {
    author: {
      participantId: leader.id,
      participantName: leader.name,
      personaId: leader.personaId,
      llmId: leader.llmId,
    },
  };
  incompleteLeaderMessage.generator = {
    ...incompleteLeaderMessage.generator,
    upstreamHandle: {
      uht: 'vnd.oai.responses',
      responseId: 'resp_resume_single',
      startingAfter: 42,
      expiresAt: null,
    },
  };
  conversation.messages = [userMessage, incompleteLeaderMessage];

  const inferred = inferResumableCouncilSession(conversation);
  assert.ok(inferred);
  assert.equal(inferred?.mode, 'round-robin-per-human');
  assert.equal(inferred?.status, 'interrupted');
  assert.equal(inferred?.canResume, true);
});

test('inferResumableCouncilSession hides single-assistant resume when the interrupted reply has no supported upstream reattach handle', () => {
  useModelsStore.setState(state => ({
    ...state,
    sources: state.sources.map(service =>
      service.id !== 'test-service'
        ? service
        : {
            ...service,
            setup: {
              ...service.setup,
              oaiHost: 'https://proxy.example.invalid',
            },
          },
    ),
  }));

  const conversation = createDConversation('Developer');
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Nova Yield', 'every-turn', true);
  conversation.participants = [human, leader];
  conversation.turnTerminationMode = 'round-robin-per-human';

  const userMessage = completeMessage(createDMessageTextContent('user', 'Find me transport options.'));
  const incompleteLeaderMessage = createDMessagePlaceholderIncomplete('assistant', '...');
  incompleteLeaderMessage.metadata = {
    author: {
      participantId: leader.id,
      participantName: leader.name,
      personaId: leader.personaId,
      llmId: leader.llmId,
    },
  };
  incompleteLeaderMessage.generator = {
    ...incompleteLeaderMessage.generator,
    upstreamHandle: {
      uht: 'vnd.oai.responses',
      responseId: 'resp_resume_proxy',
      startingAfter: 163,
      expiresAt: null,
    },
  };
  conversation.messages = [userMessage, incompleteLeaderMessage];

  assert.equal(inferResumableCouncilSession(conversation), null);

  useModelsStore.setState(state => ({
    ...state,
    sources: state.sources.map(service =>
      service.id !== 'test-service'
        ? service
        : {
            ...service,
            setup: {
              ...service.setup,
              oaiHost: '',
            },
          },
    ),
  }));
});

test('inferResumableCouncilSession exposes room resume for outstanding mention follow-ups', () => {
  const conversation = createDConversation('Developer');
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic');
  const writer = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Writer', 'when-mentioned');
  conversation.participants = [human, leader, critic, writer];
  conversation.turnTerminationMode = 'round-robin-per-human';

  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer plainly.'));
  const leaderMessage = completeMessage(createDMessageTextContent('assistant', '@Writer please review this.'));
  leaderMessage.metadata = {
    author: {
      participantId: leader.id,
      participantName: leader.name,
      personaId: leader.personaId,
      llmId: leader.llmId,
    },
  };
  const criticMessage = completeMessage(createDMessageTextContent('assistant', 'Looks fine.'));
  criticMessage.metadata = {
    author: {
      participantId: critic.id,
      participantName: critic.name,
      personaId: critic.personaId,
      llmId: critic.llmId,
    },
  };
  conversation.messages = [userMessage, leaderMessage, criticMessage];
  conversation.councilSession = {
    status: 'interrupted',
    executeMode: 'generate-content',
    mode: 'round-robin-per-human',
    phaseId: null,
    passIndex: 0,
    workflowState: null,
    canResume: true,
    interruptionReason: '@pause',
    updatedAt: Date.now(),
  };

  const inferred = inferResumableCouncilSession(conversation);
  assert.ok(inferred);
  assert.equal(inferred?.mode, 'round-robin-per-human');
  assert.equal(inferred?.status, 'interrupted');
  assert.equal(inferred?.canResume, true);
});
