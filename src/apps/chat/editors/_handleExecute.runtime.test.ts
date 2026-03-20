import assert from 'node:assert/strict';
import test from 'node:test';

import { Agent } from '~/modules/aifn/react/react';
import type { DConversationParticipant, DPersistedCouncilSession } from '~/common/stores/chat/chat.conversation';
import { createAssistantConversationParticipant, createDConversation, createHumanConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { createDMessagePlaceholderIncomplete, createDMessageTextContent, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { create_FunctionCallInvocation_ContentFragment, createModelAuxVoidFragment, createTextContentFragment, isToolInvocationPart, isToolResponseFunctionCallPart } from '~/common/stores/chat/chat.fragments';
import { createPerChatVanillaStore } from '~/common/chat-overlay/store-perchat_vanilla';
import { createIdleCouncilSessionState } from '~/common/chat-overlay/store-perchat-composer_slice';
import { inferResumableCouncilSession } from '~/common/chat-overlay/ConversationHandler';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useModelsStore } from '~/common/stores/llms/store-llms';
import type { DModelParameterSpecAny, DModelParameterValues } from '~/common/stores/llms/llms.parameters';
import type { DLLM } from '~/common/stores/llms/llms.types';

import { _handleExecute, runCouncilSequence } from './_handleExecute';
import type { ChatExecutionRuntime, ChatExecutionRuntimeRunPersonaParams, ChatExecutionSession } from './chat-execution.runtime';
import { applyCouncilReviewBallots, createCouncilSessionState, recordCouncilProposal, recordCouncilReviewerPlan, recordCouncilReviewerVote } from './_handleExecute.council';
import { createCouncilOp } from './_handleExecute.council.log';


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

function setTestLLMs(parameterSpecs: DModelParameterSpecAny[], userParameters?: DModelParameterValues) {
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
      parameterSpecs,
      initialParameters: {
        llmRef: TEST_LLM_ID,
        llmTemperature: 0.5,
        llmResponseTokens: 1024,
      },
      sId: 'test-service',
      vId: 'openai',
      ...(userParameters ? { userParameters } : {}),
    } satisfies DLLM],
  }));
}

function createParticipants() {
  return [
    createHumanConversationParticipant('You'),
    createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true),
    createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic'),
    createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Writer'),
  ] satisfies DConversationParticipant[];
}

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function scriptedCouncilAcceptReply(): ScriptedReply {
  return {
    finalText: '',
    fragments: [
      create_FunctionCallInvocation_ContentFragment('tool-accept', 'Accept', '{}'),
    ],
  };
}

function scriptedCouncilRejectReply(reason: string): ScriptedReply {
  return {
    finalText: '',
    fragments: [
      create_FunctionCallInvocation_ContentFragment('tool-reject', 'Improve', JSON.stringify({ reason })),
    ],
  };
}

function scriptedCouncilRejectNoReasonReply(): ScriptedReply {
  return {
    finalText: '',
    fragments: [
      create_FunctionCallInvocation_ContentFragment('tool-reject', 'Improve', '{}'),
    ],
  };
}

function scriptedCouncilAcceptReviewReply(analysis: string): ScriptedReply {
  return {
    finalText: '',
    fragments: [
      createTextContentFragment(analysis),
      create_FunctionCallInvocation_ContentFragment('tool-accept', 'Accept', '{}'),
    ],
  };
}

function scriptedCouncilRejectReviewReply(analysis: string, reason: string): ScriptedReply {
  return {
    finalText: '',
    fragments: [
      createTextContentFragment(analysis),
      create_FunctionCallInvocation_ContentFragment('tool-reject', 'Improve', JSON.stringify({ reason })),
    ],
  };
}

function scriptedExitLoopReply(): ScriptedReply {
  return {
    finalText: '',
    fragments: [
      create_FunctionCallInvocation_ContentFragment('tool-exit-loop', 'Exit_loop', '{}'),
    ],
  };
}

function scriptedReasoningOnlyExitLoopReply(reasoning: string): ScriptedReply {
  return {
    finalText: '',
    fragments: [
      createModelAuxVoidFragment('reasoning', reasoning),
      create_FunctionCallInvocation_ContentFragment('tool-exit-loop', 'Exit_loop', '{}'),
    ],
  };
}

function scriptedTextAndExitLoopReply(text: string): ScriptedReply {
  return {
    finalText: '',
    fragments: [
      createTextContentFragment(text),
      create_FunctionCallInvocation_ContentFragment('tool-exit-loop', 'Exit_loop', '{}'),
    ],
  };
}

function importConversationForTest(params: {
  participants: DConversationParticipant[];
  messages: ReturnType<typeof createDMessageTextContent>[];
  turnTerminationMode?: 'round-robin-per-human' | 'continuous' | 'council';
  councilSession?: DPersistedCouncilSession | null;
  councilOpLog?: import('./_handleExecute.council.log').CouncilOp[] | null;
  councilMaxRounds?: number;
}) {
  const conversation = createDConversation('Developer');
  conversation.participants = params.participants.map(participant => ({ ...participant }));
  conversation.systemPurposeId = 'Developer';
  conversation.turnTerminationMode = params.turnTerminationMode ?? 'council';
  conversation.messages = params.messages.map(message => ({ ...message }));
  conversation.councilSession = params.councilSession ?? null;
  conversation.councilOpLog = params.councilOpLog ?? null;
  if (params.councilMaxRounds !== undefined)
    Object.assign(conversation, { councilMaxRounds: params.councilMaxRounds });
  conversation.updated = Date.now();

  return useChatStore.getState().importConversation(conversation, true);
}

type ScriptedReply = string | {
  finalText: string;
  fragments?: ReturnType<typeof createDMessageTextContent>['fragments'];
  waitFor?: Promise<unknown>;
  onStart?: () => void;
  onComplete?: () => void;
};

type PersonaInvocation = {
  participantId: string;
  sourceHistoryText: string;
  sourceHistoryToolInvocationCount: number;
  sourceHistoryToolResponseCount: number;
  requestedToolNames: string[];
  requestedToolsPolicy: unknown;
  existingAssistantMessageId: string | null;
  existingAssistantUpstreamHandleResponseId: string | null;
  llmUserParametersReplacement: DModelParameterValues | null;
};

type BeamInvocation = {
  inputHistoryLength: number;
};

class ScriptedChatExecutionRuntime implements ChatExecutionRuntime {
  readonly callLog: string[] = [];
  readonly invocations: PersonaInvocation[] = [];
  readonly beamInvocations: BeamInvocation[] = [];
  private readonly sessions = new Map<string, ChatExecutionSession>();

  constructor(private readonly scriptedRepliesByParticipantId: Map<string, ScriptedReply[]>) {
  }

  getSession(conversationId: string): ChatExecutionSession {
    const existingSession = this.sessions.get(conversationId);
    if (existingSession)
      return existingSession;

    const overlayStore = createPerChatVanillaStore();
    const resumableCouncilSession = inferResumableCouncilSession(
      useChatStore.getState().conversations.find(conversation => conversation.id === conversationId) ?? null,
    );
    if (resumableCouncilSession?.canResume) {
      overlayStore.getState().setCouncilSession({
        ...createIdleCouncilSessionState(),
        ...resumableCouncilSession,
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
      beamInvoke: (inputHistory) => {
        this.beamInvocations.push({
          inputHistoryLength: inputHistory.length,
        });
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
      persistCouncilState: (nextSession, councilOpLog) => useChatStore.getState().setCouncilPersistence(conversationId, nextSession, councilOpLog),
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
    this.invocations.push({
      participantId,
      sourceHistoryText: (params.sourceHistory ?? [])
        .map(message => messageFragmentsReduceText(message.fragments))
        .filter(Boolean)
        .join('\n\n'),
      sourceHistoryToolInvocationCount: (params.sourceHistory ?? [])
        .flatMap(message => message.fragments)
        .filter(fragment => 'part' in fragment && isToolInvocationPart(fragment.part))
        .length,
      sourceHistoryToolResponseCount: (params.sourceHistory ?? [])
        .flatMap(message => message.fragments)
        .filter(fragment => 'part' in fragment && isToolResponseFunctionCallPart(fragment.part))
        .length,
      requestedToolNames: (() => {
        const transformedRequest = params.runOptions?.requestTransform?.({
          systemMessage: null,
          chatSequence: [],
          tools: [{
            type: 'function_call',
            function_call: {
              name: 'WebSearch',
              description: 'Search the web.',
              input_schema: {
                properties: {
                  query: { type: 'string' },
                },
                required: ['query'],
              },
            },
          }],
        } as any);
        return transformedRequest?.tools?.flatMap((tool: any) => tool?.type === 'function_call' ? [tool.function_call.name] : []) ?? [];
      })(),
      requestedToolsPolicy: (() => {
        const transformedRequest = params.runOptions?.requestTransform?.({
          systemMessage: null,
          chatSequence: [],
          tools: [{
            type: 'function_call',
            function_call: {
              name: 'WebSearch',
              description: 'Search the web.',
              input_schema: {
                properties: {
                  query: { type: 'string' },
                },
                required: ['query'],
              },
            },
          }],
          toolsPolicy: { type: 'required', toolNames: ['WebSearch'] },
        } as any);
        return transformedRequest?.toolsPolicy;
      })(),
      existingAssistantMessageId: params.runOptions?.existingAssistantMessageId ?? null,
      existingAssistantUpstreamHandleResponseId: params.runOptions?.existingAssistantUpstreamHandle?.responseId ?? null,
      llmUserParametersReplacement: params.runOptions?.llmUserParametersReplacement
        ? structuredClone(params.runOptions.llmUserParametersReplacement)
        : null,
    });

    const scriptedReplies = this.scriptedRepliesByParticipantId.get(participantId) ?? [];
    const nextReply = scriptedReplies.shift();
    if (!nextReply)
      throw new Error(`Missing scripted reply for ${participantId}`);

    const scriptedReply = typeof nextReply === 'string'
      ? { finalText: nextReply }
      : nextReply;
    scriptedReply.onStart?.();
    if (scriptedReply.waitFor)
      await scriptedReply.waitFor;

    const finalMessage = createDMessageTextContent('assistant', scriptedReply.finalText);
    if (scriptedReply.fragments)
      finalMessage.fragments = structuredClone(scriptedReply.fragments);
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
      if (params.runOptions?.existingAssistantMessageId) {
        params.session.messageEdit(params.runOptions.existingAssistantMessageId, existingMessage => ({
          ...finalMessage,
          id: existingMessage.id,
          created: existingMessage.created,
        }), true, false);
      } else {
        params.session.messageAppend(finalMessage);
      }
    }

    scriptedReply.onComplete?.();

    return {
      success: true,
      finalMessage,
      assistantMessageId: null,
    };
  }
}

test('runCouncilSequence can complete a full no-model council loop', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [participants[1].id, ['Draft one.', 'Draft two with caveat.']],
    [participants[2].id, [scriptedCouncilRejectReviewReply('Critic analysis one.', 'Missing the caveat.'), scriptedCouncilAcceptReviewReply('Critic analysis two.')]],
    [participants[3].id, [scriptedCouncilAcceptReviewReply('Writer analysis one.'), scriptedCouncilAcceptReviewReply('Writer analysis two.')]],
  ]));

  const result = await runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    12,
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
  const resultMessage = messages.find(message => message.metadata?.council?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Draft two with caveat.');
});

test('runCouncilSequence gives reviewer ballot turns the normal tools plus explicit Accept and Improve tools', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader, critic, writer] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Draft one.', 'Draft two.']],
    [critic.id, [
      scriptedCouncilRejectReviewReply('Critic analysis one.', 'Missing the caveat.'),
      scriptedCouncilAcceptReviewReply('Critic analysis two.'),
    ]],
    [writer.id, [
      scriptedCouncilAcceptReviewReply('Writer analysis one.'),
      scriptedCouncilAcceptReviewReply('Writer analysis two.'),
    ]],
  ]));

  const result = await runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    1,
    userMessage.id,
    null,
    runtime,
  );

  assert.equal(result, true);
  assert.equal(runtime.callLog.filter(participantId => participantId === critic.id).length, 2);

  const leaderInvocation = runtime.invocations.filter(invocation => invocation.participantId === leader.id)[0];
  const criticReviewInvocation = runtime.invocations.filter(invocation => invocation.participantId === critic.id)[0];

  assert.ok(leaderInvocation);
  assert.doesNotMatch(leaderInvocation?.sourceHistoryText ?? '', /Stateful Council mode is active\./);
  assert.doesNotMatch(leaderInvocation?.sourceHistoryText ?? '', /You are the Leader\./);
  assert.doesNotMatch(leaderInvocation?.sourceHistoryText ?? '', /Write the single best user-facing answer/i);
  assert.doesNotMatch(leaderInvocation?.sourceHistoryText ?? '', /Output only the proposal text/i);
  assert.match(leaderInvocation?.sourceHistoryText ?? '', /Use @mentions to ask other agents to continue when the room supports mention follow-ups\./);

  assert.deepEqual(criticReviewInvocation?.requestedToolNames, ['WebSearch', 'Accept', 'Improve']);
  assert.deepEqual(criticReviewInvocation?.requestedToolsPolicy, { type: 'required', toolNames: ['WebSearch'] });
  assert.match(criticReviewInvocation?.sourceHistoryText ?? '', /Use @mentions to ask other agents to continue when the room supports mention follow-ups\./);
  assert.match(criticReviewInvocation?.sourceHistoryText ?? '', /Analyze the current Leader proposal:/);
  assert.match(criticReviewInvocation?.sourceHistoryText ?? '', /Then return your verdict by calling exactly one tool:/);
  assert.doesNotMatch(criticReviewInvocation?.sourceHistoryText ?? '', /Improve\(reason\)/);
  assert.doesNotMatch(criticReviewInvocation?.sourceHistoryText ?? '', /Stateful Council mode is active\./);
  assert.doesNotMatch(criticReviewInvocation?.sourceHistoryText ?? '', /You are a reviewer\./);
  assert.doesNotMatch(criticReviewInvocation?.sourceHistoryText ?? '', /write exactly one concise review plan/i);

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[critic.id]?.terminalAction, 'reject');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[critic.id]?.terminalReason, 'Missing the caveat.');
});

test('runCouncilSequence marks reviewer replies without a ballot tool as missing verdict', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader, critic, writer] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Draft one.', 'Draft two with caveat.']],
    [critic.id, [
      'The draft is missing the key caveat about retries.',
      'Still no ballot.',
      scriptedCouncilAcceptReviewReply('Critic analysis after revision.'),
    ]],
    [writer.id, [
      scriptedCouncilAcceptReviewReply('Writer analysis one.'),
      scriptedCouncilAcceptReviewReply('Writer analysis after revision.'),
    ]],
  ]));

  const result = await runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    1,
    userMessage.id,
    null,
    runtime,
  );

  assert.equal(result, true);

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[critic.id]?.terminalAction, 'reject');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[critic.id]?.terminalReason, 'review verdict missing');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[critic.id]?.reason, 'review verdict missing');
  assert.equal(messageFragmentsReduceText(councilSession.workflowState?.rounds[0]?.reviewerVotes[critic.id]?.messageFragments ?? []), 'The draft is missing the key caveat about retries.\n\nStill no ballot.');
});

test('runCouncilSequence repairs a missing reviewer ballot with a forced follow-up verdict turn', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader, critic, writer] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Draft one.', 'Draft two with caveat.']],
    [critic.id, [
      'The draft is missing the key caveat about retries.',
      {
        finalText: '',
        fragments: [
          create_FunctionCallInvocation_ContentFragment('tool-reject-repair', 'Improve', JSON.stringify({ reason: 'Missing the key caveat about retries.' })),
        ],
      },
      scriptedCouncilAcceptReviewReply('Critic analysis after revision.'),
    ]],
    [writer.id, [
      scriptedCouncilAcceptReviewReply('Writer analysis one.'),
      scriptedCouncilAcceptReviewReply('Writer analysis after revision.'),
    ]],
  ]));

  const result = await runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    1,
    userMessage.id,
    null,
    runtime,
  );

  assert.equal(result, true);

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[critic.id]?.terminalAction, 'reject');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[critic.id]?.terminalReason, 'Missing the key caveat about retries.');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[critic.id]?.reason, 'Missing the key caveat about retries.');
  assert.equal(messageFragmentsReduceText(councilSession.workflowState?.rounds[0]?.reviewerVotes[critic.id]?.messageFragments ?? []), 'The draft is missing the key caveat about retries.');

  const criticInvocations = runtime.invocations.filter(invocation => invocation.participantId === critic.id);
  assert.equal(criticInvocations.length, 3);
  assert.deepEqual(criticInvocations[1]?.requestedToolNames, ['Accept', 'Improve']);
  assert.deepEqual(criticInvocations[1]?.requestedToolsPolicy, { type: 'any' });
  assert.match(criticInvocations[1]?.sourceHistoryText ?? '', /Your previous review did not submit the required verdict tool call\./);
  assert.match(criticInvocations[1]?.sourceHistoryText ?? '', /Your review analysis was:\nThe draft is missing the key caveat about retries\./);
});

test('runCouncilSequence stops cleanly when the leader fails to produce a valid proposal', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, [{ finalText: '' }, { finalText: '' }, { finalText: '' }]],
    [participants[2].id, [{ finalText: '' }, { finalText: '' }, { finalText: '' }]],
    [participants[3].id, [{ finalText: '' }, { finalText: '' }, { finalText: '' }]],
  ]));

  const result = await runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    1,
    userMessage.id,
    null,
    runtime,
  );

  assert.equal(result, false);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  assert.equal(messages.some(message => messageFragmentsReduceText(message.fragments).includes('Leader failed to produce a valid proposal. Council will stop.')), true);

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.status, 'stopped');
  assert.equal(councilSession.canResume, false);
  assert.equal(councilSession.workflowState?.status, 'interrupted');
  assert.equal(councilSession.workflowState?.interruptionReason, 'leader-invalid-proposal');

  const conversation = useChatStore.getState().conversations.find(item => item.id === conversationId) ?? null;
  assert.equal(conversation?.councilSession?.status, 'stopped');
  assert.equal(conversation?.councilSession?.canResume, false);
  assert.equal(conversation?.councilSession?.interruptionReason, 'leader-invalid-proposal');
  assert.equal(conversation?.councilOpLog?.some(op => op.type === 'session_stopped' && op.payload.reason === 'leader-invalid-proposal'), true);
});

test('runCouncilSequence keeps user-stopped councils resumable', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const stopAfterLeader = createDeferred<void>();
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    turnTerminationMode: 'council',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, [{
      finalText: 'Draft one.',
      onComplete: () => stopAfterLeader.resolve(),
    }]],
  ]));

  const runPromise = runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    3,
    userMessage.id,
    null,
    runtime,
  );

  await stopAfterLeader.promise;
  useChatStore.getState().conversations.find(item => item.id === conversationId)?._abortController?.abort('@stop');
  const result = await runPromise;

  assert.equal(result, false);
  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.status, 'stopped');
  assert.equal(councilSession.canResume, true);
  assert.equal(councilSession.interruptionReason, '@stop');

  const conversation = useChatStore.getState().conversations.find(item => item.id === conversationId) ?? null;
  assert.equal(conversation?.councilSession?.status, 'stopped');
  assert.equal(conversation?.councilSession?.canResume, true);
  assert.equal(conversation?.councilSession?.interruptionReason, '@stop');
  assert.equal(conversation?.councilOpLog?.some(op => op.type === 'session_stopped' && op.payload.reason === '@stop'), true);
});

test('generate-content can target only the leader from council mode when the user message explicitly selects that participant', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader, critic, writer] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Leader, answer this directly.'));
  userMessage.metadata = {
    ...userMessage.metadata,
    councilChannel: { channel: 'public-board' },
    initialRecipients: [{ rt: 'participant', participantId: leader.id }],
  };
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    turnTerminationMode: 'council',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Leader only reply.']],
    [critic.id, ['Critic should not run.']],
    [writer.id, ['Writer should not run.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'chat-target-leader-only', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id]);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  const assistantMessages = messages.filter(message => message.role === 'assistant');
  assert.equal(assistantMessages.length, 1);
  assert.equal(assistantMessages[0]?.metadata?.author?.participantId, leader.id);
  assert.equal(messageFragmentsReduceText(assistantMessages[0]!.fragments), 'Leader only reply.');
  assert.equal(messages.some(message => message.metadata?.council?.kind === 'result'), false);
});

test('runCouncilSequence runs the leader first, then reviewers perform one parallel review turn each', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader, critic, writer] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });

  const leaderGate = createDeferred();
  const leaderStarted = createDeferred();
  const criticReviewGate = createDeferred();
  const writerReviewGate = createDeferred();
  const criticStarted = createDeferred();
  const writerStarted = createDeferred();

  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, [{
      finalText: '[[proposal]] Draft one with caveat.',
      waitFor: leaderGate.promise,
      onStart: () => leaderStarted.resolve(),
    }]],
    [critic.id, [
      {
        ...scriptedCouncilAcceptReviewReply('Critic analysis.'),
        waitFor: criticReviewGate.promise,
        onStart: () => criticStarted.resolve(),
      },
    ]],
    [writer.id, [
      {
        ...scriptedCouncilAcceptReviewReply('Writer analysis.'),
        waitFor: writerReviewGate.promise,
        onStart: () => writerStarted.resolve(),
      },
    ]],
  ]));

  const runPromise = runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    12,
    userMessage.id,
    null,
    runtime,
  );

  await leaderStarted.promise;
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(runtime.callLog, [leader.id]);

  leaderGate.resolve();
  await criticStarted.promise;
  await writerStarted.promise;
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, writer.id]);

  criticReviewGate.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(runtime.callLog.filter(participantId => participantId === critic.id).length, 1);
  assert.equal(runtime.callLog.filter(participantId => participantId === writer.id).length, 1);

  writerReviewGate.resolve();
  const result = await runPromise;
  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, writer.id]);
});

test('runCouncilSequence shares all prior round agent messages with every agent from round 2 onward', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader, critic, writer] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, [
      '[[proposal]] Draft one.',
      '[[proposal]] Draft two with caveat.',
    ]],
    [critic.id, [
      scriptedCouncilRejectReviewReply('Critic analysis one.', 'Missing the caveat.'),
      scriptedCouncilAcceptReviewReply('Critic analysis two.'),
    ]],
    [writer.id, [
      scriptedCouncilAcceptReviewReply('Writer analysis one.'),
      scriptedCouncilAcceptReviewReply('Writer analysis two.'),
    ]],
  ]));

  const result = await runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    12,
    userMessage.id,
    null,
    runtime,
  );

  assert.equal(result, true);

  const leaderRoundTwoInvocation = runtime.invocations.filter(invocation => invocation.participantId === leader.id)[1];
  assert.ok(leaderRoundTwoInvocation);
  assert.match(leaderRoundTwoInvocation.sourceHistoryText, /Draft one\./);
  assert.match(leaderRoundTwoInvocation.sourceHistoryText, /Critic analysis one\./);
  assert.match(leaderRoundTwoInvocation.sourceHistoryText, /Improve\(\): Missing the caveat\./);
  assert.match(leaderRoundTwoInvocation.sourceHistoryText, /Writer analysis one\./);
  assert.match(leaderRoundTwoInvocation.sourceHistoryText, /Accept/);
  assert.doesNotMatch(leaderRoundTwoInvocation.sourceHistoryText, /Leader proposal:/);
  assert.doesNotMatch(leaderRoundTwoInvocation.sourceHistoryText, /Reviewer analysis:/);
  assert.equal(leaderRoundTwoInvocation.sourceHistoryToolInvocationCount, 0);
  assert.equal(leaderRoundTwoInvocation.sourceHistoryToolResponseCount, 0);
  assert.ok(leaderRoundTwoInvocation.sourceHistoryText.indexOf('Draft one.') < leaderRoundTwoInvocation.sourceHistoryText.indexOf('Critic analysis one.'));
  assert.ok(leaderRoundTwoInvocation.sourceHistoryText.indexOf('Critic analysis one.') < leaderRoundTwoInvocation.sourceHistoryText.indexOf('Improve(): Missing the caveat.'));
  assert.ok(leaderRoundTwoInvocation.sourceHistoryText.indexOf('Improve(): Missing the caveat.') < leaderRoundTwoInvocation.sourceHistoryText.indexOf('Writer analysis one.'));

  const criticRoundTwoReviewInvocation = runtime.invocations.filter(invocation => invocation.participantId === critic.id)[1];
  assert.ok(criticRoundTwoReviewInvocation);
  assert.match(criticRoundTwoReviewInvocation.sourceHistoryText, /Draft one\./);
  assert.match(criticRoundTwoReviewInvocation.sourceHistoryText, /Critic analysis one\./);
  assert.match(criticRoundTwoReviewInvocation.sourceHistoryText, /Improve\(\): Missing the caveat\./);
  assert.match(criticRoundTwoReviewInvocation.sourceHistoryText, /Writer analysis one\./);
  assert.match(criticRoundTwoReviewInvocation.sourceHistoryText, /Accept/);
  assert.equal(criticRoundTwoReviewInvocation.sourceHistoryToolInvocationCount, 0);
  assert.equal(criticRoundTwoReviewInvocation.sourceHistoryToolResponseCount, 0);
  assert.ok(criticRoundTwoReviewInvocation.sourceHistoryText.indexOf('Draft one.') < criticRoundTwoReviewInvocation.sourceHistoryText.indexOf('Critic analysis one.'));
  assert.ok(criticRoundTwoReviewInvocation.sourceHistoryText.indexOf('Critic analysis one.') < criticRoundTwoReviewInvocation.sourceHistoryText.indexOf('Improve(): Missing the caveat.'));
  assert.ok(criticRoundTwoReviewInvocation.sourceHistoryText.indexOf('Improve(): Missing the caveat.') < criticRoundTwoReviewInvocation.sourceHistoryText.indexOf('Writer analysis one.'));
});

test('runCouncilSequence keeps same-round reviewer analyses isolated during parallel review', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader, critic, writer] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Round one proposal.', 'Round two proposal.']],
    [critic.id, [
      scriptedCouncilRejectReply('Missing the caveat.'),
      scriptedCouncilAcceptReviewReply('Critic analysis round two.'),
    ]],
    [writer.id, [
      scriptedCouncilAcceptReviewReply('Writer analysis.'),
      scriptedCouncilAcceptReviewReply('Writer analysis round two.'),
    ]],
  ]));

  const result = await runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    1,
    userMessage.id,
    null,
    runtime,
  );

  assert.equal(result, true);

  const criticReviewInvocation = runtime.invocations.filter(invocation => invocation.participantId === critic.id)[0];
  const writerReviewInvocation = runtime.invocations.filter(invocation => invocation.participantId === writer.id)[0];

  assert.match(criticReviewInvocation?.sourceHistoryText ?? '', /Round one proposal\./);
  assert.doesNotMatch(criticReviewInvocation?.sourceHistoryText ?? '', /Writer plan: verify the wording stays concise\./);
  assert.match(writerReviewInvocation?.sourceHistoryText ?? '', /Round one proposal\./);
  assert.doesNotMatch(writerReviewInvocation?.sourceHistoryText ?? '', /Critic plan: verify the caveat is present\./);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  const nonResultCouncilMessages = messages.filter(message => {
    const kind = message.metadata?.council?.kind;
    return kind && kind !== 'result';
  });
  assert.deepEqual(nonResultCouncilMessages, []);
});

test('handleExecute stops council after the configured max rounds', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    councilMaxRounds: 1,
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [participants[1].id, ['Draft one.']],
    [participants[2].id, [scriptedCouncilRejectReviewReply('Critic analysis one.', 'Missing the caveat.')]],
    [participants[3].id, [scriptedCouncilAcceptReviewReply('Writer analysis one.')]],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, false);
  assert.deepEqual(runtime.callLog, [
    participants[1].id,
    participants[2].id,
    participants[3].id,
  ]);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  assert.deepEqual(messages.filter(message => !!message.metadata?.council), []);

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.workflowState?.status, 'exhausted');
  assert.equal(councilSession.workflowState?.maxRounds, 1);
});

test('handleExecute resumes a partially reviewed council round without rerunning completed reviewers', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const leader = participants[1];
  const critic = participants[2];
  const writer = participants[3];
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const proposalMessage = completeMessage(createDMessageTextContent('assistant', 'Draft one.'));
  const phaseId = 'phase-1';
  proposalMessage.metadata = {
    author: {
      participantId: leader.id,
      participantName: leader.name,
      personaId: leader.personaId,
      llmId: leader.llmId,
    },
    councilChannel: { channel: 'public-board' },
    council: {
      kind: 'deliberation',
      phaseId,
      passIndex: 0,
      action: 'proposal',
      agreedResponse: 'Draft one.',
      leaderParticipantId: leader.id,
    },
  };
  const criticBallotMessage = completeMessage(createDMessageTextContent('assistant', 'Critic analysis one.'));
  criticBallotMessage.metadata = {
    author: {
      participantId: critic.id,
      participantName: critic.name,
      personaId: critic.personaId,
      llmId: critic.llmId,
    },
    councilChannel: { channel: 'public-board' },
    council: {
      kind: 'deliberation',
      phaseId,
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
  councilState = recordCouncilReviewerPlan(councilState, {
    reviewerParticipantId: critic.id,
    planText: 'Critic plan.',
  });
  councilState = recordCouncilReviewerPlan(councilState, {
    reviewerParticipantId: writer.id,
    planText: 'Writer plan.',
  });
  councilState = {
    ...councilState,
    status: 'reviewing',
    rounds: councilState.rounds.map(round => ({
      ...round,
      phase: round.roundIndex === 0 ? 'reviewer-votes' : round.phase,
      reviewerVotes: round.roundIndex === 0
        ? {
            ...round.reviewerVotes,
            [critic.id]: {
              reviewerParticipantId: critic.id,
              ballot: { reviewerParticipantId: critic.id, decision: 'accept' as const },
              reason: null,
              messageFragments: [
                createTextContentFragment('Critic analysis one.'),
                create_FunctionCallInvocation_ContentFragment('accept-critic', 'Accept', '{}'),
              ],
              messagePendingIncomplete: false,
              events: [],
              createdAt: 1,
            },
          }
        : round.reviewerVotes,
      ballots: round.roundIndex === 0
        ? [{ reviewerParticipantId: critic.id, decision: 'accept' as const }]
        : round.ballots,
    })),
  };
  const councilOpLog = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: leader.id,
      reviewerParticipantIds: [critic.id, writer.id],
      maxRounds: 12,
      latestUserMessageId: userMessage.id,
    }, {
      phaseId,
      conversationId: 'conversation-partial-review-resume',
      opId: 'session-started',
      createdAt: 100,
    }),
  ];
  councilOpLog.push(createCouncilOp(councilOpLog, 'leader_turn_committed', {
    roundIndex: 0,
    participantId: leader.id,
    proposalId: proposalMessage.id,
    proposalText: 'Draft one.',
    deliberationText: '',
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-partial-review-resume',
    opId: 'leader-0',
    createdAt: 101,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_vote_committed', {
    roundIndex: 0,
    participantId: critic.id,
    decision: 'accept',
    reason: null,
    fragmentTexts: ['Critic analysis one.'],
    messageFragments: [
      createTextContentFragment('Critic analysis one.'),
      create_FunctionCallInvocation_ContentFragment('accept-critic', 'Accept', '{}'),
    ],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-partial-review-resume',
    opId: 'vote-critic',
    createdAt: 102,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'session_paused', {
    reason: 'page-unload',
  }, {
    phaseId,
    conversationId: 'conversation-partial-review-resume',
    opId: 'session-paused',
    createdAt: 103,
  }));

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage, proposalMessage, criticBallotMessage],
    councilOpLog,
    councilSession: {
      status: 'interrupted',
      executeMode: 'generate-content',
      mode: 'council',
      phaseId,
      passIndex: 0,
      workflowState: councilState,
      canResume: true,
      interruptionReason: 'page-unload',
      updatedAt: Date.now(),
    },
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [writer.id, [scriptedCouncilAcceptReviewReply('Writer analysis one.')]],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [writer.id]);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  const resultMessage = messages.find(message => message.metadata?.council?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Draft one.');
});

test('handleExecute resumes a council round by rerunning reviewers whose persisted vote only says review failed', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const leader = participants[1];
  const critic = participants[2];
  const writer = participants[3];
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const phaseId = 'phase-retry-review-failed';
  const councilOpLog = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: leader.id,
      reviewerParticipantIds: [critic.id, writer.id],
      maxRounds: 12,
      latestUserMessageId: userMessage.id,
    }, {
      phaseId,
      conversationId: 'conversation-retry-review-failed',
      opId: 'session-started',
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
    conversationId: 'conversation-retry-review-failed',
    opId: 'leader-0',
    createdAt: 101,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_vote_committed', {
    roundIndex: 0,
    participantId: critic.id,
    decision: 'accept',
    reason: null,
    fragmentTexts: ['Critic analysis one.'],
    messageFragments: [
      createTextContentFragment('Critic analysis one.'),
      create_FunctionCallInvocation_ContentFragment('accept-critic', 'Accept', '{}'),
    ],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-retry-review-failed',
    opId: 'vote-critic',
    createdAt: 102,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_vote_committed', {
    roundIndex: 0,
    participantId: writer.id,
    decision: 'reject',
    reason: 'review failed',
    fragmentTexts: ['review failed'],
    messageFragments: [
      createTextContentFragment('review failed'),
    ],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-retry-review-failed',
    opId: 'vote-writer-failed',
    createdAt: 103,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'session_paused', {
    reason: 'page-unload',
  }, {
    phaseId,
    conversationId: 'conversation-retry-review-failed',
    opId: 'session-paused',
    createdAt: 104,
  }));

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    councilSession: null,
    councilOpLog,
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [writer.id, [scriptedCouncilAcceptReviewReply('Writer analysis one.')]],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [writer.id]);

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[writer.id]?.ballot.decision, 'accept');

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  const resultMessage = messages.find(message => message.metadata?.council?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Draft one.');
});

test('handleExecute resumes from councilOpLog without rerunning committed turns', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const leader = participants[1];
  const critic = participants[2];
  const writer = participants[3];
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const phaseId = 'phase-log-resume';
  const councilOpLog = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: leader.id,
      reviewerParticipantIds: [critic.id, writer.id],
      maxRounds: 12,
      latestUserMessageId: userMessage.id,
    }, {
      phaseId,
      conversationId: 'conversation-log-resume',
      opId: 'session-started',
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
    conversationId: 'conversation-log-resume',
    opId: 'leader-0',
    createdAt: 101,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_plan_committed', {
    roundIndex: 0,
    participantId: critic.id,
    planText: 'Critic plan.',
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-log-resume',
    opId: 'plan-critic',
    createdAt: 102,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_plan_committed', {
    roundIndex: 0,
    participantId: writer.id,
    planText: 'Writer plan.',
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-log-resume',
    opId: 'plan-writer',
    createdAt: 103,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_vote_committed', {
    roundIndex: 0,
    participantId: critic.id,
    decision: 'accept',
    reason: null,
    fragmentTexts: ['Critic analysis one.'],
    messageFragments: [
      createTextContentFragment('Critic analysis one.'),
      create_FunctionCallInvocation_ContentFragment('accept-critic', 'Accept', '{}'),
    ],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-log-resume',
    opId: 'vote-critic',
    createdAt: 104,
  }));

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    councilSession: null,
    councilOpLog,
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [writer.id, [scriptedCouncilAcceptReviewReply('Writer analysis one.')]],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [writer.id]);

  const resultMessage = (useChatStore.getState().historyView(conversationId) ?? [])
    .find(message => message.metadata?.council?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Draft one.');
});

test('handleExecute resumes a council run from a persisted checkpoint when the councilOpLog is missing', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const leader = participants[1];
  const critic = participants[2];
  const writer = participants[3];
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const workflowState = createCouncilSessionState({
    phaseId: 'phase-persisted-session-resume',
    leaderParticipantId: leader.id,
    reviewerParticipantIds: [critic.id, writer.id],
    maxRounds: 12,
  });

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    councilSession: {
      status: 'interrupted',
      executeMode: 'generate-content',
      mode: 'council',
      phaseId: workflowState.phaseId,
      passIndex: workflowState.roundIndex,
      workflowState,
      canResume: true,
      interruptionReason: 'page-unload',
      updatedAt: userMessage.created + 1,
    },
    councilOpLog: null,
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Draft one.']],
    [critic.id, [scriptedCouncilAcceptReviewReply('Critic analysis one.')]],
    [writer.id, [scriptedCouncilAcceptReviewReply('Writer analysis one.')]],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, writer.id]);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  const resultMessage = messages.find(message => message.metadata?.council?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Draft one.');
});

test('handleExecute resumes a second-round council checkpoint when the councilOpLog is missing', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const leader = participants[1];
  const critic = participants[2];
  const writer = participants[3];
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  let workflowState = createCouncilSessionState({
    phaseId: 'phase-persisted-second-round-resume',
    leaderParticipantId: leader.id,
    reviewerParticipantIds: [critic.id, writer.id],
    maxRounds: 12,
  });
  workflowState = recordCouncilProposal(workflowState, {
    proposalId: 'proposal-round-0',
    leaderParticipantId: leader.id,
    proposalText: 'Draft one.',
  });
  workflowState = applyCouncilReviewBallots(workflowState, [
    { reviewerParticipantId: critic.id, decision: 'reject', reason: 'Missing the caveat.' },
    { reviewerParticipantId: writer.id, decision: 'accept' },
  ]);

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    councilSession: {
      status: 'interrupted',
      executeMode: 'generate-content',
      mode: 'council',
      phaseId: workflowState.phaseId,
      passIndex: workflowState.roundIndex,
      workflowState,
      canResume: true,
      interruptionReason: 'page-unload',
      updatedAt: userMessage.created + 1,
    },
    councilOpLog: null,
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Draft two with caveat.']],
    [critic.id, [scriptedCouncilAcceptReviewReply('Critic analysis two.')]],
    [writer.id, [scriptedCouncilAcceptReviewReply('Writer analysis two.')]],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, writer.id]);

  const conversation = useChatStore.getState().conversations.find(item => item.id === conversationId) ?? null;
  assert.equal(conversation?.councilOpLog?.some(op => op.type === 'round_started' && op.payload.roundIndex === 1), true);

  const resultMessage = (useChatStore.getState().historyView(conversationId) ?? [])
    .find(message => message.metadata?.council?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Draft two with caveat.');
});

test('runCouncilSequence persists a resumable council checkpoint while the leader is still processing', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const leader = participants[1];
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const deferred = createDeferred<void>();
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, [{
      finalText: 'Draft one.',
      waitFor: deferred.promise,
    }]],
  ]));

  const runPromise = runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    1,
    userMessage.id,
    null,
    runtime,
  );

  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));

  const conversationDuringRun = useChatStore.getState().conversations.find(item => item.id === conversationId) ?? null;
  assert.equal(conversationDuringRun?.councilSession?.status, 'interrupted');
  assert.equal(conversationDuringRun?.councilSession?.canResume, true);
  assert.equal(conversationDuringRun?.councilSession?.mode, 'council');
  assert.equal(conversationDuringRun?.councilSession?.interruptionReason, 'page-unload');
  assert.equal(conversationDuringRun?.councilSession?.workflowState?.status, 'drafting');
  assert.ok(conversationDuringRun?.councilSession?.phaseId);

  useChatStore.getState().abortConversationTemp(conversationId);
  deferred.resolve();

  const result = await runPromise;
  assert.equal(result, false);
});

test('runCouncilSequence accepts a ballot-only reviewer accept', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader, critic, writer] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Draft one.']],
    [critic.id, [scriptedCouncilAcceptReviewReply('Critic analysis one.')]],
    [writer.id, [scriptedCouncilAcceptReply()]],
  ]));

  const result = await runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    1,
    userMessage.id,
    null,
    runtime,
  );

  assert.equal(result, true);

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[writer.id]?.ballot.decision, 'accept');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[writer.id]?.reason, null);
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[writer.id]?.terminalAction, 'accept');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[writer.id]?.terminalReason, null);
});

test('runCouncilSequence rejects reviewer accepts that only provide hidden reasoning without visible analysis', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader, critic, writer] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Draft one.', 'Draft two with explicit rationale.']],
    [critic.id, [
      scriptedCouncilAcceptReviewReply('Critic analysis one.'),
      scriptedCouncilAcceptReviewReply('Critic analysis two.'),
    ]],
    [writer.id, [
      {
        finalText: '',
        fragments: [
          createModelAuxVoidFragment('reasoning', 'I am leaning toward accepting this because the proposal seems solid enough.'),
          create_FunctionCallInvocation_ContentFragment('tool-accept-hidden-reasoning', 'Accept', '{}'),
        ],
      },
      scriptedCouncilAcceptReviewReply('Writer analysis two.'),
    ]],
  ]));

  const result = await runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    1,
    userMessage.id,
    null,
    runtime,
  );

  assert.equal(result, true);

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.workflowState?.status, 'accepted');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[writer.id]?.ballot.decision, 'reject');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[writer.id]?.reason, 'review analysis missing');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[writer.id]?.terminalAction, 'reject');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[writer.id]?.terminalReason, 'review analysis missing');
  assert.equal(councilSession.workflowState?.rounds[1]?.reviewerVotes[writer.id]?.ballot.decision, 'accept');
});

test('runCouncilSequence accepts reviewer ballots even when pre-ballot text is meta-only', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader, critic, writer] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Draft one.']],
    [critic.id, [scriptedCouncilAcceptReviewReply('Critic analysis one.')]],
    [writer.id, [{
      finalText: '',
      fragments: [
        createTextContentFragment('I need to inspect the proposal carefully before deciding.'),
        createTextContentFragment('The proposal seems solid, but I still need to evaluate the cited sources and claims.'),
        create_FunctionCallInvocation_ContentFragment('tool-accept-meta', 'Accept', '{}'),
      ],
    }]],
  ]));

  const result = await runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    1,
    userMessage.id,
    null,
    runtime,
  );

  assert.equal(result, true);

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[writer.id]?.ballot.decision, 'accept');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[writer.id]?.reason, null);
});

test('runCouncilSequence accepts reviewer reject ballots without an explicit reason argument', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader, critic, writer] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Draft one.', 'Draft two.']],
    [critic.id, [
      scriptedCouncilRejectNoReasonReply(),
      scriptedCouncilAcceptReviewReply('Critic analysis after revision.'),
    ]],
    [writer.id, [
      scriptedCouncilAcceptReviewReply('Writer analysis one.'),
      scriptedCouncilAcceptReviewReply('Writer analysis two.'),
    ]],
  ]));

  const result = await runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    1,
    userMessage.id,
    null,
    runtime,
  );

  assert.equal(result, true);

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[critic.id]?.ballot.decision, 'reject');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[critic.id]?.reason, null);
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[critic.id]?.terminalReason, null);
});

test('runCouncilSequence allows reviewer intent text when non-ballot tool activity is present', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const [, leader, critic, writer] = participants;
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Draft one.']],
    [critic.id, [scriptedCouncilAcceptReviewReply('Critic analysis one.')]],
    [writer.id, [{
      finalText: '',
      fragments: [
        createTextContentFragment('I need to inspect the proposal carefully before deciding.'),
        create_FunctionCallInvocation_ContentFragment('tool-search', 'WebSearch', '{"query":"tenerife market data"}'),
        createTextContentFragment('The proposal seems solid, but I still need to evaluate the cited sources and claims.'),
        create_FunctionCallInvocation_ContentFragment('tool-accept-meta-with-tool', 'Accept', '{}'),
      ],
    }]],
  ]));

  const result = await runCouncilSequence(
    runtime.getSession(conversationId),
    conversationId,
    participants.slice(1),
    TEST_LLM_ID,
    1,
    userMessage.id,
    null,
    runtime,
  );

  assert.equal(result, true);

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[writer.id]?.ballot.decision, 'accept');
});

test('handleExecute keeps persisted accept votes even when they contain no reviewer analysis', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const leader = participants[1];
  const critic = participants[2];
  const writer = participants[3];
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const phaseId = 'phase-retry-empty-accept';
  const councilOpLog = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: leader.id,
      reviewerParticipantIds: [critic.id, writer.id],
      maxRounds: 12,
      latestUserMessageId: userMessage.id,
    }, {
      phaseId,
      conversationId: 'conversation-retry-empty-accept',
      opId: 'session-started',
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
    conversationId: 'conversation-retry-empty-accept',
    opId: 'leader-0',
    createdAt: 101,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_vote_committed', {
    roundIndex: 0,
    participantId: critic.id,
    decision: 'accept',
    reason: null,
    fragmentTexts: ['Critic analysis one.'],
    messageFragments: [
      createTextContentFragment('Critic analysis one.'),
      create_FunctionCallInvocation_ContentFragment('accept-critic', 'Accept', '{}'),
    ],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-retry-empty-accept',
    opId: 'vote-critic',
    createdAt: 102,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_vote_committed', {
    roundIndex: 0,
    participantId: writer.id,
    decision: 'accept',
    reason: null,
    fragmentTexts: [],
    messageFragments: [
      create_FunctionCallInvocation_ContentFragment('accept-writer', 'Accept', '{}'),
    ],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-retry-empty-accept',
    opId: 'vote-writer-empty',
    createdAt: 103,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'session_paused', {
    reason: 'page-unload',
  }, {
    phaseId,
    conversationId: 'conversation-retry-empty-accept',
    opId: 'session-paused',
    createdAt: 104,
  }));

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    councilSession: null,
    councilOpLog,
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [writer.id, [scriptedCouncilAcceptReviewReply('Writer analysis one.')]],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, []);

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerVotes[writer.id]?.ballot.decision, 'accept');
  assert.equal(messageFragmentsReduceText(councilSession.workflowState?.rounds[0]?.reviewerVotes[writer.id]?.messageFragments ?? []), '');
});

test('handleExecute resumes the same incomplete room message before continuing with the remaining agents', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const leader = participants[1];
  const critic = participants[2];
  const writer = participants[3];
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
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
      responseId: 'resp_resume_leader',
      expiresAt: null,
    },
  };

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage, incompleteLeaderMessage],
    turnTerminationMode: 'round-robin-per-human',
    councilSession: {
      status: 'interrupted',
      executeMode: 'generate-content',
      mode: 'round-robin-per-human',
      phaseId: null,
      passIndex: 0,
      workflowState: null,
      canResume: true,
      interruptionReason: 'page-unload',
      updatedAt: Date.now(),
    },
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Leader finished.']],
    [critic.id, ['Critic reply.']],
    [writer.id, ['Writer reply.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, writer.id]);
  assert.equal(runtime.invocations[0]?.existingAssistantMessageId, incompleteLeaderMessage.id);
  assert.equal(runtime.invocations[0]?.existingAssistantUpstreamHandleResponseId, 'resp_resume_leader');
  assert.equal(runtime.invocations[1]?.existingAssistantUpstreamHandleResponseId, null);
  assert.equal(runtime.invocations[2]?.existingAssistantUpstreamHandleResponseId, null);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  const assistantMessages = messages.filter(message => message.role === 'assistant');
  assert.equal(assistantMessages.length, 3);

  const resumedLeaderMessage = assistantMessages.find(message => message.id === incompleteLeaderMessage.id) ?? null;
  assert.ok(resumedLeaderMessage);
  assert.equal(messageFragmentsReduceText(resumedLeaderMessage!.fragments), 'Leader finished.');
});

test('handleExecute resumes outstanding room follow-ups introduced by assistant mentions', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic');
  const writer = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Writer', 'when-mentioned');
  const participants = [human, leader, critic, writer];
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const leaderMessage = completeMessage(createDMessageTextContent('assistant', '@Writer please verify the final wording.'));
  leaderMessage.metadata = {
    author: {
      participantId: leader.id,
      participantName: leader.name,
      personaId: leader.personaId,
      llmId: leader.llmId,
    },
  };
  const criticMessage = completeMessage(createDMessageTextContent('assistant', 'Critic reply.'));
  criticMessage.metadata = {
    author: {
      participantId: critic.id,
      participantName: critic.name,
      personaId: critic.personaId,
      llmId: critic.llmId,
    },
  };

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage, leaderMessage, criticMessage],
    turnTerminationMode: 'round-robin-per-human',
    councilSession: {
      status: 'interrupted',
      executeMode: 'generate-content',
      mode: 'round-robin-per-human',
      phaseId: null,
      passIndex: 0,
      workflowState: null,
      canResume: true,
      interruptionReason: '@pause',
      updatedAt: Date.now(),
    },
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Leader should not rerun.']],
    [critic.id, ['Critic should not rerun.']],
    [writer.id, ['Writer follow-up.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [writer.id]);
});

test('handleExecute does not rerun a completed researcher-style room message that already says completed', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const leader = participants[1];
  const critic = participants[2];
  const writer = participants[3];
  const userMessage = completeMessage(createDMessageTextContent('user', 'Validate this Tenerife market answer.'));
  const completedResearchMessage = completeMessage(createDMessageTextContent('assistant', 'site:gobiernodecanarias.org turismo viviendas vacacionales ley 6/2025: completed'));
  completedResearchMessage.fragments = [
    createTextContentFragment('site:gobiernodecanarias.org turismo viviendas vacacionales ley 6/2025: completed'),
    createModelAuxVoidFragment('reasoning', 'Checked official Canary Islands sources and cross-referenced the cited law.'),
  ];
  completedResearchMessage.metadata = {
    author: {
      participantId: leader.id,
      participantName: leader.name,
      personaId: leader.personaId,
      llmId: leader.llmId,
    },
  };

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage, completedResearchMessage],
    turnTerminationMode: 'round-robin-per-human',
    councilSession: {
      status: 'interrupted',
      executeMode: 'generate-content',
      mode: 'round-robin-per-human',
      phaseId: null,
      passIndex: 0,
      workflowState: null,
      canResume: true,
      interruptionReason: '@pause',
      updatedAt: Date.now(),
    },
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Leader should not rerun.']],
    [critic.id, ['Critic follow-up.']],
    [writer.id, ['Writer follow-up.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [critic.id, writer.id]);
  assert.equal(runtime.invocations.some(invocation => invocation.participantId === leader.id), false);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  const preservedResearchMessage = messages.find(message => message.id === completedResearchMessage.id) ?? null;
  assert.ok(preservedResearchMessage);
  assert.equal(messageFragmentsReduceText(preservedResearchMessage!.fragments), 'site:gobiernodecanarias.org turismo viviendas vacacionales ley 6/2025: completed');
});

test('handleExecute keeps uncommitted reviewer votes out of councilOpLog after interruption', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const leader = participants[1];
  const critic = participants[2];
  const writer = participants[3];
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer the user clearly.'));
  const phaseId = 'phase-log-interrupt';
  const councilOpLog = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: leader.id,
      reviewerParticipantIds: [critic.id, writer.id],
      maxRounds: 12,
      latestUserMessageId: userMessage.id,
    }, {
      phaseId,
      conversationId: 'conversation-log-interrupt',
      opId: 'session-started',
      createdAt: 200,
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
    conversationId: 'conversation-log-interrupt',
    opId: 'leader-0',
    createdAt: 201,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_plan_committed', {
    roundIndex: 0,
    participantId: critic.id,
    planText: 'Critic plan.',
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-log-interrupt',
    opId: 'plan-critic',
    createdAt: 202,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_plan_committed', {
    roundIndex: 0,
    participantId: writer.id,
    planText: 'Writer plan.',
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-log-interrupt',
    opId: 'plan-writer',
    createdAt: 203,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_vote_committed', {
    roundIndex: 0,
    participantId: writer.id,
    decision: 'accept',
    reason: null,
    fragmentTexts: ['Writer analysis one.'],
    messageFragments: [
      createTextContentFragment('Writer analysis one.'),
      create_FunctionCallInvocation_ContentFragment('accept-writer', 'Accept', '{}'),
    ],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-log-interrupt',
    opId: 'vote-writer',
    createdAt: 204,
  }));

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    councilSession: null,
    councilOpLog,
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [critic.id, [{
      ...scriptedCouncilRejectReply('This should not commit.'),
      onStart: () => useChatStore.getState().abortConversationTemp(conversationId),
    }]],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, false);
  assert.deepEqual(runtime.callLog, [critic.id]);

  const conversation = useChatStore.getState().conversations.find(item => item.id === conversationId) ?? null;
  const persistedVoteParticipantIds = (conversation?.councilOpLog ?? [])
    .filter(op => op.type === 'reviewer_vote_committed')
    .map(op => op.payload.participantId);
  assert.deepEqual(persistedVoteParticipantIds, [writer.id]);
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
    [participants[2].id, [scriptedCouncilRejectReviewReply('Critic analysis one.', 'Missing the caveat.'), scriptedCouncilAcceptReviewReply('Critic analysis two.')]],
    [participants[3].id, [scriptedCouncilAcceptReviewReply('Writer analysis one.'), scriptedCouncilAcceptReviewReply('Writer analysis two.')]],
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
  const resultMessage = messages.find(message => message.metadata?.council?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Draft two with caveat.');

  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.status, 'completed');
  assert.equal(councilSession.workflowState?.status, 'accepted');
  assert.equal(councilSession.workflowState?.finalResponse, 'Draft two with caveat.');
  assert.equal(councilSession.workflowState?.rounds[0]?.leaderTurn?.terminalAction, 'proposal');
  assert.equal(councilSession.workflowState?.rounds[0]?.leaderTurn?.terminalText, 'Draft one.');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[participants[2].id]?.deliberationText, 'Critic analysis one.');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[participants[2].id]?.terminalAction, 'reject');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[participants[2].id]?.terminalReason, 'Missing the caveat.');
  assert.equal(councilSession.workflowState?.rounds[0]?.reviewerTurns[participants[3].id]?.deliberationText, 'Writer analysis one.');
  assert.equal(councilSession.workflowState?.rounds[1]?.reviewerTurns[participants[2].id]?.deliberationText, 'Critic analysis two.');
  assert.equal(councilSession.workflowState?.rounds[1]?.reviewerTurns[participants[2].id]?.terminalAction, 'accept');
  assert.ok((councilSession.workflowState?.rounds[1]?.reviewerTurns[participants[3].id]?.events.length ?? 0) > 0);

  const conversation = useChatStore.getState().conversations.find(item => item.id === conversationId) ?? null;
  assert.equal(conversation?.councilSession?.status, 'completed');
  assert.equal(conversation?.councilSession?.canResume, false);
  assert.equal(conversation?.councilSession?.workflowState?.status, 'accepted');
  assert.equal(conversation?.councilSession?.workflowState?.finalResponse, 'Draft two with caveat.');
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
    council: {
      kind: 'deliberation',
      phaseId: 'phase-stale',
      passIndex: 0,
      action: 'proposal',
      leaderParticipantId: leader.id,
    },
  };
  const criticBallotMessage = completeMessage(createDMessageTextContent('assistant', 'Improve()'));
  criticBallotMessage.metadata = {
    author: {
      participantId: critic.id,
      participantName: critic.name,
      personaId: critic.personaId,
      llmId: critic.llmId,
    },
    councilChannel: { channel: 'public-board' },
    council: {
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
      mode: 'council',
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
    [critic.id, [scriptedCouncilAcceptReviewReply('Fresh critic analysis.')]],
    [writer.id, [scriptedCouncilAcceptReviewReply('Fresh writer analysis.')]],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, writer.id]);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  const resultMessage = messages.findLast(message => message.metadata?.council?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Fresh proposal for the second request.');
});

test('handleExecute ignores stale councilOpLog after a new user turn', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const leader = participants[1];
  const critic = participants[2];
  const writer = participants[3];

  const userMessageOne = completeMessage(createDMessageTextContent('user', 'First request.'));
  const userMessageTwo = completeMessage(createDMessageTextContent('user', 'Second request.'));
  const phaseId = 'phase-stale-log';
  const councilOpLog = [
    createCouncilOp([], 'session_started', {
      leaderParticipantId: leader.id,
      reviewerParticipantIds: [critic.id, writer.id],
      maxRounds: 12,
      latestUserMessageId: userMessageOne.id,
    }, {
      phaseId,
      conversationId: 'conversation-stale-log',
      opId: 'session-started',
      createdAt: 100,
    }),
  ];
  councilOpLog.push(createCouncilOp(councilOpLog, 'leader_turn_committed', {
    roundIndex: 0,
    participantId: leader.id,
    proposalId: 'proposal-1',
    proposalText: 'Old draft.',
    deliberationText: '',
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-stale-log',
    opId: 'leader-0',
    createdAt: 101,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_plan_committed', {
    roundIndex: 0,
    participantId: critic.id,
    planText: 'Critic old plan.',
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-stale-log',
    opId: 'plan-critic',
    createdAt: 102,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_plan_committed', {
    roundIndex: 0,
    participantId: writer.id,
    planText: 'Writer old plan.',
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-stale-log',
    opId: 'plan-writer',
    createdAt: 103,
  }));
  councilOpLog.push(createCouncilOp(councilOpLog, 'reviewer_vote_committed', {
    roundIndex: 0,
    participantId: critic.id,
    decision: 'accept',
    reason: null,
    fragmentTexts: [],
    messageFragments: [],
    messagePendingIncomplete: false,
  }, {
    phaseId,
    conversationId: 'conversation-stale-log',
    opId: 'vote-critic',
    createdAt: 104,
  }));

  const conversationId = importConversationForTest({
    participants,
    messages: [userMessageOne, userMessageTwo],
    councilSession: null,
    councilOpLog,
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Fresh proposal for the second request.']],
    [critic.id, [scriptedCouncilAcceptReviewReply('Fresh critic analysis.')]],
    [writer.id, [scriptedCouncilAcceptReviewReply('Fresh writer analysis.')]],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, writer.id]);

  const resultMessage = (useChatStore.getState().historyView(conversationId) ?? [])
    .findLast(message => message.metadata?.council?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Fresh proposal for the second request.');
});

test('handleExecute returns immediately for append-user without invoking personas or beam', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Keep this as a draft.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    turnTerminationMode: 'round-robin-per-human',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map());

  const result = await _handleExecute('append-user', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, []);
  assert.deepEqual(runtime.beamInvocations, []);
});

test('handleExecute invokes beam mode without running personas', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Compare these options.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    turnTerminationMode: 'round-robin-per-human',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map());

  const result = await _handleExecute('beam-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, []);
  assert.equal(runtime.beamInvocations.length, 1);
  assert.equal(runtime.beamInvocations[0]?.inputHistoryLength, 1);
});

test('handleExecute includes the full visible assistant roster in a sole agent prompt', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const planner = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Planner', 'every-turn', true);
  const devil = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Devil\'s Advocate', 'when-mentioned');
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer as the planner only.'));
  const conversationId = importConversationForTest({
    participants: [human, planner, devil],
    messages: [userMessage],
    turnTerminationMode: 'round-robin-per-human',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [planner.id, ['Planner reply.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  const plannerInvocation = runtime.invocations.find(invocation => invocation.participantId === planner.id);
  assert.ok(plannerInvocation);
  assert.match(plannerInvocation?.sourceHistoryText ?? '', /Current agent roster and speaking order:/);
  assert.match(plannerInvocation?.sourceHistoryText ?? '', /Planner[\s\S]*\[you are this agent\]/);
  assert.match(plannerInvocation?.sourceHistoryText ?? '', /Devil's Advocate/);
  assert.match(plannerInvocation?.sourceHistoryText ?? '', /speaks only when @mentioned/);
  assert.match(plannerInvocation?.sourceHistoryText ?? '', /Use @mentions to ask other agents to continue when the room supports mention follow-ups\./);
  assert.match(plannerInvocation?.sourceHistoryText ?? '', /Use @all to bring in every other agent, and do not @mention yourself\./);
});

test('handleExecute applies participant reasoning effort as a model override', async () => {
  resetChatStoreForTest();
  setTestLLMs(
    [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh'] }],
    { llmVndOaiVerbosity: 'low' },
  );

  const human = createHumanConversationParticipant('You');
  const planner = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Planner', 'every-turn', true);
  planner.reasoningEffort = 'xhigh';
  const userMessage = completeMessage(createDMessageTextContent('user', 'Answer as the planner only.'));
  const conversationId = importConversationForTest({
    participants: [human, planner],
    messages: [userMessage],
    turnTerminationMode: 'round-robin-per-human',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [planner.id, ['Planner reply.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  const plannerInvocation = runtime.invocations.find(invocation => invocation.participantId === planner.id);
  assert.deepEqual(plannerInvocation?.llmUserParametersReplacement, {
    llmVndOaiVerbosity: 'low',
    llmVndOaiEffort: 'xhigh',
  });
});

test('handleExecute includes inactive room participants in multi-agent prompts', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const planner = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Planner', 'every-turn', true);
  const analyst = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Analyst', 'every-turn');
  const devil = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Devil\'s Advocate', 'when-mentioned');
  const userMessage = completeMessage(createDMessageTextContent('user', 'Discuss this together.'));
  const conversationId = importConversationForTest({
    participants: [human, planner, analyst, devil],
    messages: [userMessage],
    turnTerminationMode: 'round-robin-per-human',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [planner.id, ['Planner reply.']],
    [analyst.id, ['Analyst reply.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  const plannerInvocation = runtime.invocations.find(invocation => invocation.participantId === planner.id);
  const analystInvocation = runtime.invocations.find(invocation => invocation.participantId === analyst.id);
  assert.ok(plannerInvocation);
  assert.ok(analystInvocation);
  assert.match(plannerInvocation?.sourceHistoryText ?? '', /Devil's Advocate/);
  assert.match(analystInvocation?.sourceHistoryText ?? '', /Devil's Advocate/);
  assert.match(plannerInvocation?.sourceHistoryText ?? '', /speaks only when @mentioned/);
  assert.match(analystInvocation?.sourceHistoryText ?? '', /speaks only when @mentioned/);
});

test('handleExecute does not expose Exit_loop to the leader on its first agents loop turn', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic', 'every-turn');
  const userMessage = completeMessage(createDMessageTextContent('user', 'Start the loop.'));
  const conversationId = importConversationForTest({
    participants: [human, leader, critic],
    messages: [userMessage],
    turnTerminationMode: 'continuous',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Leader first turn.', scriptedTextAndExitLoopReply('Leader closes the loop.')]],
    [critic.id, ['Critic turn.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  const leaderInvocation = runtime.invocations.find(invocation => invocation.participantId === leader.id);
  const criticInvocation = runtime.invocations.find(invocation => invocation.participantId === critic.id) ?? null;
  assert.ok(leaderInvocation);
  assert.deepEqual(leaderInvocation?.requestedToolNames, []);
  assert.doesNotMatch(leaderInvocation?.sourceHistoryText ?? '', /If you decide the loop should end after your reply, call the Exit_loop tool\./);
  assert.ok(criticInvocation);
});

test('handleExecute ignores Exit_loop if the leader tries to call it on the first agents loop turn', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic', 'every-turn');
  const userMessage = completeMessage(createDMessageTextContent('user', 'Start the loop.'));
  const conversationId = importConversationForTest({
    participants: [human, leader, critic],
    messages: [userMessage],
    turnTerminationMode: 'continuous',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, [scriptedExitLoopReply(), scriptedTextAndExitLoopReply('Leader closes the loop.')]],
    [critic.id, ['Critic turn.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, leader.id]);
  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.status, 'stopped');
  assert.equal(councilSession.interruptionReason, '@exit-loop');
});

test('handleExecute keeps Exit_loop instructions off non-leader prompts in agents loop mode', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic', 'every-turn');
  const userMessage = completeMessage(createDMessageTextContent('user', 'Start the loop.'));
  const conversationId = importConversationForTest({
    participants: [human, leader, critic],
    messages: [userMessage],
    turnTerminationMode: 'continuous',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Leader keeps the loop moving.', scriptedTextAndExitLoopReply('Leader closes the loop.')]],
    [critic.id, ['Critic replies once.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  const leaderInvocations = runtime.invocations.filter(invocation => invocation.participantId === leader.id);
  const criticInvocation = runtime.invocations.find(invocation => invocation.participantId === critic.id);
  assert.equal(leaderInvocations.length, 2);
  assert.ok(criticInvocation);
  assert.doesNotMatch(leaderInvocations[0]?.sourceHistoryText ?? '', /If you decide the loop should end after your reply, call the Exit_loop tool\./);
  assert.match(leaderInvocations[1]?.sourceHistoryText ?? '', /If you decide the loop should end after your reply, call the Exit_loop tool\./);
  assert.doesNotMatch(criticInvocation?.sourceHistoryText ?? '', /If you decide the loop should end after your reply, call the Exit_loop tool\./);
  assert.deepEqual(criticInvocation?.requestedToolNames, []);
});

test('handleExecute exposes Exit_loop to the leader after the first agents loop turn', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic', 'every-turn');
  const userMessage = completeMessage(createDMessageTextContent('user', 'Start the loop.'));
  const conversationId = importConversationForTest({
    participants: [human, leader, critic],
    messages: [userMessage],
    turnTerminationMode: 'continuous',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Leader first turn.', scriptedTextAndExitLoopReply('Leader closes the loop.')]],
    [critic.id, ['Critic turn.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  const leaderInvocations = runtime.invocations.filter(invocation => invocation.participantId === leader.id);
  assert.equal(leaderInvocations.length, 2);
  assert.deepEqual(leaderInvocations[0]?.requestedToolNames, []);
  assert.deepEqual(leaderInvocations[1]?.requestedToolNames, ['WebSearch', 'Exit_loop']);
  assert.doesNotMatch(leaderInvocations[0]?.sourceHistoryText ?? '', /If you decide the loop should end after your reply, call the Exit_loop tool\./);
  assert.match(leaderInvocations[1]?.sourceHistoryText ?? '', /If you decide the loop should end after your reply, call the Exit_loop tool\./);
  assert.match(leaderInvocations[1]?.sourceHistoryText ?? '', /Only call Exit_loop in the same turn where you provide the final visible reply for the user/i);
});

test('handleExecute ignores Exit_loop until the leader emits visible reply content in that turn', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic', 'every-turn');
  const userMessage = completeMessage(createDMessageTextContent('user', 'Start the loop.'));
  const conversationId = importConversationForTest({
    participants: [human, leader, critic],
    messages: [userMessage],
    turnTerminationMode: 'continuous',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, [
      'Leader first turn.',
      scriptedReasoningOnlyExitLoopReply('I might be done, but I should let the room continue first.'),
      scriptedTextAndExitLoopReply('Leader final answer.'),
    ]],
    [critic.id, [
      'Critic turn.',
      'Critic second turn.',
    ]],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, leader.id, critic.id, leader.id]);
  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.status, 'stopped');
  assert.equal(councilSession.interruptionReason, '@exit-loop');

  const leaderMessages = (useChatStore.getState().historyView(conversationId) ?? [])
    .filter(message => message.role === 'assistant' && message.metadata?.author?.participantId === leader.id);
  assert.equal(leaderMessages.length, 3);
  assert.equal(messageFragmentsReduceText(leaderMessages[1]!.fragments), '');
  assert.equal(messageFragmentsReduceText(leaderMessages[2]!.fragments), 'Leader final answer.');
});

test('handleExecute ignores Exit_loop when the leader text is only meta reasoning about process instead of a real user-facing reply', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic', 'every-turn');
  const userMessage = completeMessage(createDMessageTextContent('user', 'Start the loop.'));
  const conversationId = importConversationForTest({
    participants: [human, leader, critic],
    messages: [userMessage],
    turnTerminationMode: 'continuous',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, [
      'Leader first turn.',
      scriptedTextAndExitLoopReply(`**Finalizing strategy recommendations**

I'm thinking about finalizing the missing components. Maybe I could mention @Critic for another pass, but a final answer might be better. If we're concluding the loop, I'll need to make sure to call Exit_loop after my response.`),
      scriptedTextAndExitLoopReply('Leader final answer.'),
    ]],
    [critic.id, [
      'Critic turn.',
      'Critic second turn.',
    ]],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, leader.id, critic.id, leader.id]);
  const councilSession = runtime.getSession(conversationId).getCouncilSession();
  assert.equal(councilSession.status, 'stopped');
  assert.equal(councilSession.interruptionReason, '@exit-loop');

  const leaderMessages = (useChatStore.getState().historyView(conversationId) ?? [])
    .filter(message => message.role === 'assistant' && message.metadata?.author?.participantId === leader.id);
  assert.equal(leaderMessages.length, 3);
  assert.match(messageFragmentsReduceText(leaderMessages[1]!.fragments), /Finalizing strategy recommendations/);
  assert.equal(messageFragmentsReduceText(leaderMessages[2]!.fragments), 'Leader final answer.');
});

test('handleExecute keeps the leader from speaking again in agents loop until the other every-turn agents have spoken', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic', 'every-turn');
  const writer = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Writer', 'every-turn');
  const userMessage = completeMessage(createDMessageTextContent('user', 'Start the loop.'));
  const conversationId = importConversationForTest({
    participants: [human, leader, critic, writer],
    messages: [userMessage],
    turnTerminationMode: 'continuous',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Leader first turn.', scriptedTextAndExitLoopReply('Leader closes the loop.')]],
    [critic.id, ['Critic turn.']],
    [writer.id, ['Writer turn.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, writer.id, leader.id]);
});

test('handleExecute lets a mentioned leader speak again in the first agents loop without Exit_loop context', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic', 'every-turn');
  const writer = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Writer', 'every-turn');
  const userMessage = completeMessage(createDMessageTextContent('user', 'Start the loop.'));
  const conversationId = importConversationForTest({
    participants: [human, leader, critic, writer],
    messages: [userMessage],
    turnTerminationMode: 'continuous',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Leader first turn.', 'Leader follow-up in loop one.', scriptedTextAndExitLoopReply('Leader closes the loop.')]],
    [critic.id, ['@Leader add a follow-up.']],
    [writer.id, ['Writer turn.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, leader.id, writer.id, leader.id]);
  const leaderInvocations = runtime.invocations.filter(invocation => invocation.participantId === leader.id);
  assert.equal(leaderInvocations.length, 3);
  assert.deepEqual(leaderInvocations[0]?.requestedToolNames, []);
  assert.deepEqual(leaderInvocations[1]?.requestedToolNames, []);
  assert.deepEqual(leaderInvocations[2]?.requestedToolNames, ['WebSearch', 'Exit_loop']);
  assert.doesNotMatch(leaderInvocations[1]?.sourceHistoryText ?? '', /If you decide the loop should end after your reply, call the Exit_loop tool\./);
});

test('handleExecute rewrites the prompt for generate-image mode and delegates to image generation', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const userMessage = completeMessage(createDMessageTextContent('user', 'Paint a sunset over the ocean.'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    turnTerminationMode: 'round-robin-per-human',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map());
  const result = await _handleExecute('generate-image', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, []);
  assert.deepEqual(runtime.beamInvocations, []);

  const messages = useChatStore.getState().historyView(conversationId) ?? [];
  assert.equal(messageFragmentsReduceText(messages[0]!.fragments), '/draw Paint a sunset over the ocean.');

  const finalAssistantMessage = messages.findLast(message => message.role === 'assistant') ?? null;
  assert.ok(finalAssistantMessage);
  assert.equal(messageFragmentsReduceText(finalAssistantMessage!.fragments), 'stub image for Paint a sunset over the ocean.');
});

test('handleExecute does not call the public room a council board when no agent was triggered in human-driven mode', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const planner = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Planner', 'when-mentioned', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic', 'when-mentioned');
  const userMessage = completeMessage(createDMessageTextContent('user', 'Anyone there?'));
  const conversationId = importConversationForTest({
    participants: [human, planner, critic],
    messages: [userMessage],
    turnTerminationMode: 'round-robin-per-human',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map());

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, false);
  const issueMessage = (useChatStore.getState().historyView(conversationId) ?? []).findLast(message => message.generator?.name === 'issue') ?? null;
  assert.ok(issueMessage);
  assert.match(messageFragmentsReduceText(issueMessage!.fragments), /No agent was triggered in the public room\./);
  assert.doesNotMatch(messageFragmentsReduceText(issueMessage!.fragments), /public council board/);
});

test('handleExecute triggers slash-aliased participants from short @mentions', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const orchestrator = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Orquestador / Chief of Staff', 'when-mentioned', true);
  const analyst = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Analista de contexto', 'when-mentioned');
  const userMessage = completeMessage(createDMessageTextContent('user', '@Orquestador, añado capa de contexto para afinar la elección.'));
  const conversationId = importConversationForTest({
    participants: [human, orchestrator, analyst],
    messages: [userMessage],
    turnTerminationMode: 'round-robin-per-human',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [orchestrator.id, ['Orchestrator reply.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [orchestrator.id]);
});

test('handleExecute still triggers mention-only participants explicitly @mentioned in a leader-targeted turn', async () => {
  resetChatStoreForTest();
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  const critic = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic', 'when-mentioned');
  const userMessage = completeMessage(createDMessageTextContent('user', '@Critic please challenge the plan.'));
  userMessage.metadata = {
    initialRecipients: [{ rt: 'participant', participantId: leader.id }],
    councilChannel: { channel: 'public-board' },
  };
  const conversationId = importConversationForTest({
    participants: [human, leader, critic],
    messages: [userMessage],
    turnTerminationMode: 'round-robin-per-human',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map([
    [leader.id, ['Leader reply.']],
    [critic.id, ['Critic reply.']],
  ]));

  const result = await _handleExecute('generate-content', conversationId, 'runtime-test', runtime);

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id]);
});

test('handleExecute rewrites the prompt for react mode and clears the abort controller afterwards', async () => {
  resetChatStoreForTest();
  const participants = createParticipants();
  const userMessage = completeMessage(createDMessageTextContent('user', 'What is the answer?'));
  const conversationId = importConversationForTest({
    participants,
    messages: [userMessage],
    turnTerminationMode: 'round-robin-per-human',
  });
  const runtime = new ScriptedChatExecutionRuntime(new Map());

  const originalReAct = Agent.prototype.reAct;
  Agent.prototype.reAct = async function(question: string) {
    return `Synthetic answer for ${question}`;
  };

  try {
    const result = await _handleExecute('react-content', conversationId, 'runtime-test', runtime);

    assert.equal(result, true);

    const messages = useChatStore.getState().historyView(conversationId) ?? [];
    assert.equal(messageFragmentsReduceText(messages[0]!.fragments), '/react What is the answer?');

    const finalAssistantMessage = messages.findLast(message => message.role === 'assistant') ?? null;
    assert.ok(finalAssistantMessage);
    assert.equal(messageFragmentsReduceText(finalAssistantMessage!.fragments), 'Synthetic answer for What is the answer?');

    const conversation = useChatStore.getState().conversations.find(item => item.id === conversationId) ?? null;
    assert.equal(conversation?._abortController ?? null, null);
  } finally {
    Agent.prototype.reAct = originalReAct;
  }
});
