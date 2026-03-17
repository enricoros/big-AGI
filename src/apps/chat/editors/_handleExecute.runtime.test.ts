import assert from 'node:assert/strict';
import test from 'node:test';

import type { DConversationParticipant, DPersistedCouncilSession } from '~/common/stores/chat/chat.conversation';
import { createAssistantConversationParticipant, createDConversation, createHumanConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { createDMessagePlaceholderIncomplete, createDMessageTextContent, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { createPerChatVanillaStore } from '~/common/chat-overlay/store-perchat_vanilla';
import { createIdleCouncilSessionState } from '~/common/chat-overlay/store-perchat-composer_slice';
import { useChatStore } from '~/common/stores/chat/store-chats';

import { _handleExecute, runConsensusSequence } from './_handleExecute';
import type { ChatExecutionRuntime, ChatExecutionRuntimeRunPersonaParams, ChatExecutionSession } from './chat-execution.runtime';
import { applyCouncilReviewBallots, createCouncilSessionState, recordCouncilProposal } from './_handleExecute.consensus';


const TEST_LLM_ID = 'test-llm';
const originalConsoleWarn = console.warn;

console.warn = ((...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('[zustand persist middleware] Unable to update item'))
    return;
  originalConsoleWarn(...args);
}) as typeof console.warn;

function applyTestMessageChannelScope(message: ReturnType<typeof createDMessageTextContent>, channel: NonNullable<ChatExecutionRuntimeRunPersonaParams['messageChannel']>) {
  message.metadata = {
    ...message.metadata,
    councilChannel: {
      ...channel,
      ...(channel.directParticipantIds ? { directParticipantIds: [...channel.directParticipantIds] } : {}),
      ...(channel.visibleToParticipantIds ? { visibleToParticipantIds: [...channel.visibleToParticipantIds] } : {}),
    },
    initialRecipients: channel.channel === 'public-board'
      ? [{ rt: 'public-board' }]
      : channel.channel === 'direct' && channel.directParticipantIds?.length
          ? channel.directParticipantIds.map(participantId => ({ rt: 'participant' as const, participantId }))
          : message.metadata?.initialRecipients,
  };
}

function completeMessage<T extends ReturnType<typeof createDMessageTextContent>>(message: T): T {
  message.updated = message.created;
  return message;
}

function resetChatStoreForTest() {
  useChatStore.setState({
    conversations: [createDConversation()],
  });
}

function createParticipants() {
  return [
    createHumanConversationParticipant('You'),
    createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true),
    createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic'),
    createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Writer'),
  ] satisfies DConversationParticipant[];
}

function importConversationForTest(params: {
  participants: DConversationParticipant[];
  messages: ReturnType<typeof createDMessageTextContent>[];
  turnTerminationMode?: 'round-robin-per-human' | 'continuous' | 'consensus';
  councilSession?: DPersistedCouncilSession | null;
}) {
  const conversation = createDConversation('Developer');
  conversation.participants = params.participants.map(participant => ({ ...participant }));
  conversation.systemPurposeId = 'Developer';
  conversation.turnTerminationMode = params.turnTerminationMode ?? 'consensus';
  conversation.messages = params.messages.map(message => ({ ...message }));
  conversation.councilSession = params.councilSession ?? null;
  conversation.updated = Date.now();

  return useChatStore.getState().importConversation(conversation, true);
}

class ScriptedChatExecutionRuntime implements ChatExecutionRuntime {
  readonly callLog: string[] = [];
  private readonly sessions = new Map<string, ChatExecutionSession>();

  constructor(private readonly scriptedRepliesByParticipantId: Map<string, string[]>) {
  }

  getSession(conversationId: string): ChatExecutionSession {
    const existingSession = this.sessions.get(conversationId);
    if (existingSession)
      return existingSession;

    const overlayStore = createPerChatVanillaStore();
    const persistedCouncilSession = useChatStore.getState().conversations.find(conversation => conversation.id === conversationId)?.councilSession ?? null;
    if (persistedCouncilSession?.canResume) {
      overlayStore.getState().setCouncilSession({
        ...createIdleCouncilSessionState(),
        ...persistedCouncilSession,
      });
    }

    const session: ChatExecutionSession = {
      conversationId,
      historyViewHeadOrThrow: (scope) => {
        const history = useChatStore.getState().historyView(conversationId);
        if (history === undefined)
          throw new Error(`allMessages: Conversation not found, ${scope}`);
        return history;
      },
      historyFindMessageOrThrow: (messageId) => useChatStore.getState().historyView(conversationId)?.find(message => message.id === messageId),
      historyClear: () => useChatStore.getState().historyReplace(conversationId, []),
      messageAppend: (message) => useChatStore.getState().appendMessage(conversationId, message),
      messageAppendAssistantText: (text, generatorName) => {
        const message = createDMessageTextContent('assistant', text);
        message.generator = { mgt: 'named', name: generatorName };
        useChatStore.getState().appendMessage(conversationId, message);
      },
      messageAppendAssistantPlaceholder: (placeholderText, update) => {
        const message = createDMessagePlaceholderIncomplete('assistant', placeholderText);
        if (update)
          Object.assign(message, update);
        useChatStore.getState().appendMessage(conversationId, message);
        return { assistantMessageId: message.id, placeholderFragmentId: message.fragments[0].fId };
      },
      messageEdit: (messageId, update, messageComplete, touch) => useChatStore.getState().editMessage(conversationId, messageId, update, messageComplete, touch),
      messageFragmentAppend: (messageId, fragment, complete, touch) => useChatStore.getState().appendMessageFragment(conversationId, messageId, fragment, complete, touch),
      messageFragmentDelete: (messageId, fragmentId, complete, touch) => useChatStore.getState().deleteMessageFragment(conversationId, messageId, fragmentId, complete, touch),
      messageFragmentReplace: (messageId, fragmentId, newFragment, messageComplete) => useChatStore.getState().replaceMessageFragment(conversationId, messageId, fragmentId, newFragment, messageComplete, true),
      beamInvoke: () => {
        throw new Error('beamInvoke not implemented in test runtime');
      },
      createEphemeralHandler: () => ({
        updateText: () => undefined,
        updateState: () => undefined,
        markAsDone: () => undefined,
      }),
      setAbortController: (abortController, debugScope) => useChatStore.getState().setAbortController(conversationId, abortController, debugScope),
      clearAbortController: (debugScope) => useChatStore.getState().setAbortController(conversationId, null, debugScope),
      getCouncilSession: () => overlayStore.getState().councilSession,
      setCouncilSession: (nextSession) => overlayStore.getState().setCouncilSession(nextSession),
      updateCouncilSession: (update) => overlayStore.getState().updateCouncilSession(update),
      resetCouncilSession: () => overlayStore.getState().resetCouncilSession(),
      persistCouncilSession: (nextSession) => useChatStore.getState().setCouncilSession(conversationId, nextSession),
    };
    this.sessions.set(conversationId, session);
    return session;
  }

  createAbortController() {
    return new AbortController();
  }

  async runPersona(params: ChatExecutionRuntimeRunPersonaParams) {
    const participantId = params.participant?.id ?? params.systemPurposeId;
    this.callLog.push(participantId);

    const scriptedReplies = this.scriptedRepliesByParticipantId.get(participantId) ?? [];
    const nextReply = scriptedReplies.shift();
    if (!nextReply)
      throw new Error(`Missing scripted reply for ${participantId}`);

    const finalMessage = createDMessageTextContent('assistant', nextReply);
    finalMessage.updated = finalMessage.created;
    finalMessage.metadata = {
      ...finalMessage.metadata,
      author: params.participant ? {
        participantId: params.participant.id,
        participantName: params.participant.name,
        personaId: params.participant.personaId,
        llmId: params.participant.llmId ?? params.assistantLlmId,
      } : undefined,
    };

    if (params.createPlaceholder !== false) {
      if (params.messageChannel)
        applyTestMessageChannelScope(finalMessage, params.messageChannel);
      params.session.messageAppend(finalMessage);
    }

    return {
      success: true,
      finalMessage,
      assistantMessageId: null,
    };
  }
}

test('runConsensusSequence can complete a full no-model council loop', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [participants[1].id, ['Draft one.', 'Draft two with caveat.']],
    [participants[2].id, ['[[reject]] Missing the caveat.', '[[accept]]']],
    [participants[3].id, ['[[accept]]', '[[accept]]']],
  ]));

  const result = await runConsensusSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    userMessage.id,
    null,
    runtime,
  );

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [
    participants[1].id,
    participants[2].id,
    participants[3].id,
    participants[1].id,
    participants[2].id,
    participants[3].id,
  ]);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  const resultMessage = messages.find(message => message.metadata?.consensus?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Draft two with caveat.');
});

test('handleExecute resumes a partially reviewed council round without rerunning completed reviewers', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const leader = participants[1];
  const critic = participants[2];
  const writer = participants[3];
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const proposalMessage = completeMessage(createDMessageTextContent('assistant', 'Draft one.'));
  proposalMessage.metadata = {
    author: {
      participantId: leader.id,
      participantName: leader.name,
      personaId: leader.personaId,
      llmId: leader.llmId,
    },
    councilChannel: { channel: 'public-board' },
    consensus: {
      kind: 'deliberation',
      phaseId: 'phase-1',
      passIndex: 0,
      action: 'proposal',
      agreedResponse: 'Draft one.',
      leaderParticipantId: leader.id,
    },
  };
  const criticBallotMessage = completeMessage(createDMessageTextContent('assistant', 'Accept'));
  criticBallotMessage.metadata = {
    author: {
      participantId: critic.id,
      participantName: critic.name,
      personaId: critic.personaId,
      llmId: critic.llmId,
    },
    councilChannel: { channel: 'public-board' },
    consensus: {
      kind: 'deliberation',
      phaseId: 'phase-1',
      passIndex: 0,
      action: 'accept',
      leaderParticipantId: leader.id,
    },
  };

  let councilState = createCouncilSessionState({
    phaseId: 'phase-1',
    leaderParticipantId: leader.id,
    reviewerParticipantIds: [critic.id, writer.id],
    maxRounds: 12,
  });
  councilState = recordCouncilProposal(councilState, {
    proposalId: proposalMessage.id,
    leaderParticipantId: leader.id,
    proposalText: 'Draft one.',
  });
  councilState = {
    ...councilState,
    status: 'reviewing',
    rounds: councilState.rounds.map(round => ({
      ...round,
      ballots: round.roundIndex === 0
        ? [{ reviewerParticipantId: critic.id, decision: 'accept' as const }]
        : round.ballots,
    })),
  };

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage, proposalMessage, criticBallotMessage],
    councilSession: {
      status: 'interrupted',
      executeMode: 'generate-content',
      mode: 'consensus',
      phaseId: 'phase-1',
      passIndex: 0,
      workflowState: councilState,
      canResume: true,
      interruptionReason: 'page-unload',
      updatedAt: Date.now(),
    },
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [writer.id, ['[[accept]]']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [writer.id]);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  const resultMessage = messages.find(message => message.metadata?.consensus?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Draft one.');
});

test('handleExecute can complete a fresh no-model council run end to end', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [participants[1].id, ['Draft one.', 'Draft two with caveat.']],
    [participants[2].id, ['[[reject]] Missing the caveat.', '[[accept]]']],
    [participants[3].id, ['[[accept]]', '[[accept]]']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [
    participants[1].id,
    participants[2].id,
    participants[3].id,
    participants[1].id,
    participants[2].id,
    participants[3].id,
  ]);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  const resultMessage = messages.find(message => message.metadata?.consensus?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Draft two with caveat.');

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.status, 'completed');
  assert.equal(councilSession.workflowState?.status, 'accepted');
  assert.equal(councilSession.workflowState?.finalResponse, 'Draft two with caveat.');
});

test('handleExecute ignores stale resumable council state after a new user turn', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [human, leader, critic, writer] = participants;

  const userMessageOne = completeMessage(createDMessageTextContent('user', 'First request.'));
  const proposalMessage = completeMessage(createDMessageTextContent('assistant', 'Draft one.'));
  proposalMessage.metadata = {
    author: {
      participantId: leader.id,
      participantName: leader.name,
      personaId: leader.personaId,
      llmId: leader.llmId,
    },
    councilChannel: { channel: 'public-board' },
    consensus: {
      kind: 'deliberation',
      phaseId: 'phase-stale',
      passIndex: 0,
      action: 'proposal',
      leaderParticipantId: leader.id,
    },
  };
  const criticBallotMessage = completeMessage(createDMessageTextContent('assistant', 'Reject'));
  criticBallotMessage.metadata = {
    author: {
      participantId: critic.id,
      participantName: critic.name,
      personaId: critic.personaId,
      llmId: critic.llmId,
    },
    councilChannel: { channel: 'public-board' },
    consensus: {
      kind: 'deliberation',
      phaseId: 'phase-stale',
      passIndex: 0,
      action: 'reject',
      reason: 'Missing the caveat.',
      leaderParticipantId: leader.id,
    },
  };
  const userMessageTwo = completeMessage(createDMessageTextContent('user', 'Second request.'));
  userMessageTwo.metadata = {
    author: {
      participantId: human.id,
      participantName: human.name,
    },
  };

  let workflowState = createCouncilSessionState({
    phaseId: 'phase-stale',
    leaderParticipantId: leader.id,
    reviewerParticipantIds: [critic.id, writer.id],
    maxRounds: 12,
  });
  workflowState = recordCouncilProposal(workflowState, {
    proposalId: proposalMessage.id,
    leaderParticipantId: leader.id,
    proposalText: 'Draft one.',
  });
  workflowState = {
    ...applyCouncilReviewBallots(workflowState, [
      { reviewerParticipantId: critic.id, decision: 'reject', reason: 'Missing the caveat.' },
      { reviewerParticipantId: writer.id, decision: 'accept' },
    ]),
    status: 'drafting',
  };

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessageOne, proposalMessage, criticBallotMessage, userMessageTwo],
    councilSession: {
      status: 'interrupted',
      executeMode: 'generate-content',
      mode: 'consensus',
      phaseId: 'phase-stale',
      passIndex: 1,
      workflowState,
      canResume: true,
      interruptionReason: 'page-unload',
      updatedAt: Date.now(),
    },
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Fresh proposal for the second request.']],
    [critic.id, ['[[accept]]']],
    [writer.id, ['[[accept]]']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, writer.id]);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  const resultMessage = messages.findLast(message => message.metadata?.consensus?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Fresh proposal for the second request.');
});
