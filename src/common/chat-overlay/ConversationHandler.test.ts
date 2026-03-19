import assert from 'node:assert/strict';
import test from 'node:test';

import { inferResumableCouncilSession } from './ConversationHandler';
import { createDConversation, createAssistantConversationParticipant, createHumanConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { createDMessagePlaceholderIncomplete, createDMessageTextContent } from '~/common/stores/chat/chat.message';
import { createCouncilOp } from '../../apps/chat/editors/_handleExecute.council.log';


const TEST_LLM_ID = 'test-llm';

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
