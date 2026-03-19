import assert from 'node:assert/strict';
import test from 'node:test';

import { createAssistantConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { createDMessageTextContent, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { createErrorContentFragment, create_FunctionCallInvocation_ContentFragment, createTextContentFragment } from '~/common/stores/chat/chat.fragments';

import { createCouncilSessionState, recordCouncilProposal, recordCouncilReviewerPlan, recordCouncilReviewerVote } from './_handleExecute.council';
import { runCouncilSequence } from './_handleExecute';
import type { ChatExecutionRuntime, ChatExecutionRuntimeRunPersonaParams, ChatExecutionSession } from './chat-execution.runtime';


const TEST_LLM_ID = 'test-llm';

type ScriptedReply = string | Error | {
  finalText: string;
  fragments: ReturnType<typeof createDMessageTextContent>['fragments'];
};

function createParticipants() {
  return [
    createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true),
    createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Critic'),
    createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Writer'),
  ];
}

function scriptedCouncilAcceptReply(): ScriptedReply {
  return {
    finalText: '',
    fragments: [
      create_FunctionCallInvocation_ContentFragment('tool-accept', 'Accept', '{}'),
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
      create_FunctionCallInvocation_ContentFragment('tool-reject', 'Reject', JSON.stringify({ reason })),
    ],
  };
}

class ScriptedRuntime implements ChatExecutionRuntime {
  readonly callLog: string[] = [];
  readonly historyLog: { participantId: string; sourceHistory: ReturnType<typeof createDMessageTextContent>[]; }[] = [];

  constructor(private readonly scriptedRepliesByParticipantId: Map<string, ScriptedReply[]>) {
  }

  getSession(_conversationId: string): ChatExecutionSession {
    throw new Error('Tests construct the session directly');
  }

  createAbortController() {
    return new AbortController();
  }

  async runPersona(params: ChatExecutionRuntimeRunPersonaParams) {
    const participantId = params.participant?.id ?? params.systemPurposeId;
    this.callLog.push(participantId);
    this.historyLog.push({
      participantId,
      sourceHistory: structuredClone(params.sourceHistory as ReturnType<typeof createDMessageTextContent>[]),
    });

    const scriptedReplies = this.scriptedRepliesByParticipantId.get(participantId) ?? [];
    const nextReply = scriptedReplies.shift();
    if (!nextReply)
      throw new Error(`Missing scripted reply for ${participantId}`);
    if (nextReply instanceof Error)
      throw nextReply;

    const scriptedReply = typeof nextReply === 'string'
      ? { finalText: nextReply }
      : nextReply;
    const finalMessage = createDMessageTextContent('assistant', scriptedReply.finalText);
    if ('fragments' in scriptedReply)
      finalMessage.fragments = structuredClone(scriptedReply.fragments);
    finalMessage.updated = finalMessage.created;
    return {
      success: true,
      finalMessage,
      assistantMessageId: null,
    };
  }
}

function createSession(history: ReturnType<typeof createDMessageTextContent>[]) {
  let councilSession: object | null = null;
  let persistedCouncilSession: object | null = null;
  let persistedCouncilOpLog: object[] | null = null;

  const session: ChatExecutionSession & {
    readonly messages: ReturnType<typeof createDMessageTextContent>[];
    readonly councilSessionRef: () => object | null;
    readonly persistedCouncilSessionRef: () => object | null;
    readonly persistedCouncilOpLogRef: () => object[] | null;
  } = {
    conversationId: 'conversation-test',
    historyViewHeadOrThrow: () => history,
    historyFindMessageOrThrow: (messageId) => history.find(message => message.id === messageId),
    historyClear: () => {
      history.splice(0, history.length);
    },
    messageAppend: (message) => {
      history.push(message);
    },
    messageAppendAssistantText: (text) => {
      history.push(createDMessageTextContent('assistant', text));
    },
    messageAppendAssistantPlaceholder: (placeholderText) => {
      const message = createDMessageTextContent('assistant', placeholderText);
      history.push(message);
      return {
        assistantMessageId: message.id,
        placeholderFragmentId: message.fragments[0]!.fId,
      };
    },
    messageEdit: () => undefined,
    messageFragmentAppend: () => undefined,
    messageFragmentDelete: () => undefined,
    messageFragmentReplace: () => undefined,
    beamInvoke: () => undefined,
    createEphemeralHandler: () => ({
      updateText: () => undefined,
      updateState: () => undefined,
      markAsDone: () => undefined,
    }),
    setAbortController: () => undefined,
    clearAbortController: () => undefined,
    getCouncilSession: () => councilSession as any,
    setCouncilSession: (nextSession) => {
      councilSession = nextSession;
    },
    updateCouncilSession: (update) => {
      councilSession = { ...(councilSession as object ?? {}), ...update };
    },
    resetCouncilSession: () => {
      councilSession = null;
    },
    persistCouncilState: (nextSession, councilOpLog) => {
      persistedCouncilSession = nextSession;
      persistedCouncilOpLog = councilOpLog as object[] | null;
    },
    messages: history,
    councilSessionRef: () => councilSession,
    persistedCouncilSessionRef: () => persistedCouncilSession,
    persistedCouncilOpLogRef: () => persistedCouncilOpLog,
  };

  return session;
}

test('runCouncilSequence accepts when reviewers analyze and vote in one turn', async () => {
  const [leader, critic, writer] = createParticipants();
  const history = [createDMessageTextContent('user', 'Answer the user clearly.')];
  const session = createSession(history);
  const runtime = new ScriptedRuntime(new Map([
    [leader.id, ['Draft one.']],
    [critic.id, [scriptedCouncilAcceptReviewReply('Critic analysis.')]],
    [writer.id, [scriptedCouncilAcceptReviewReply('Writer analysis.')]],
  ]));

  const result = await runCouncilSequence(
    session,
    session.conversationId,
    [leader, critic, writer],
    TEST_LLM_ID,
    1,
    history[0].id,
    null,
    runtime,
  );

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, writer.id]);
  const resultMessage = history.find(message => message.metadata?.council?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Draft one.');
});

test('runCouncilSequence does not throw when a resumed reviewer vote fails', async () => {
  const [leader, critic, writer] = createParticipants();
  const history = [createDMessageTextContent('user', 'Answer the user clearly.')];
  const session = createSession(history);

  let initialCouncilState = createCouncilSessionState({
    phaseId: 'phase-resume',
    leaderParticipantId: leader.id,
    reviewerParticipantIds: [critic.id, writer.id],
    maxRounds: 1,
  });
  initialCouncilState = recordCouncilProposal(initialCouncilState, {
    proposalId: 'proposal-1',
    leaderParticipantId: leader.id,
    proposalText: 'Draft one.',
  });
  initialCouncilState = recordCouncilReviewerPlan(initialCouncilState, {
    reviewerParticipantId: critic.id,
    planText: 'Critic plan.',
  });
  initialCouncilState = recordCouncilReviewerPlan(initialCouncilState, {
    reviewerParticipantId: writer.id,
    planText: 'Writer plan.',
  });
  initialCouncilState = recordCouncilReviewerVote(initialCouncilState, {
    reviewerParticipantId: critic.id,
    fragmentTexts: ['Critic analysis.'],
    ballot: {
      reviewerParticipantId: critic.id,
      decision: 'accept',
    },
    messageFragments: [
      createTextContentFragment('Critic analysis.'),
      create_FunctionCallInvocation_ContentFragment('accept-critic', 'Accept', '{}'),
    ],
  });
  initialCouncilState = {
    ...initialCouncilState,
    status: 'reviewing',
  };

  const runtime = new ScriptedRuntime(new Map([
    [writer.id, [new Error('bootstrap failed')]],
  ]));

  const result = await runCouncilSequence(
    session,
    session.conversationId,
    [leader, critic, writer],
    TEST_LLM_ID,
    1,
    history[0].id,
    initialCouncilState,
    runtime,
  );

  assert.equal(result, false);
  assert.deepEqual(runtime.callLog, [writer.id]);

  const councilSession = session.councilSessionRef() as any;
  assert.equal(councilSession?.status, 'completed');
  assert.equal(councilSession?.workflowState?.status, 'exhausted');
  assert.deepEqual(history.filter(message => !!message.metadata?.council), []);
});

test('runCouncilSequence retries the leader proposal before reviews when the persisted proposal ended with an error fragment', async () => {
  const [leader, critic, writer] = createParticipants();
  const history = [createDMessageTextContent('user', 'Answer the user clearly.')];
  const session = createSession(history);

  let initialCouncilState = createCouncilSessionState({
    phaseId: 'phase-retry-leader',
    leaderParticipantId: leader.id,
    reviewerParticipantIds: [critic.id, writer.id],
    maxRounds: 1,
  });
  initialCouncilState = recordCouncilProposal(initialCouncilState, {
    proposalId: 'proposal-1',
    leaderParticipantId: leader.id,
    proposalText: 'Interrupted draft.',
    messageFragments: [
      createTextContentFragment('Interrupted draft.'),
      createErrorContentFragment('Issue: An unexpected issue occurred: **connection terminated**.'),
    ],
    messagePendingIncomplete: false,
  });
  initialCouncilState = {
    ...initialCouncilState,
    status: 'reviewing',
  };

  const runtime = new ScriptedRuntime(new Map([
    [leader.id, ['Finished draft.']],
    [critic.id, [scriptedCouncilAcceptReviewReply('Critic analysis.')]],
    [writer.id, [scriptedCouncilAcceptReviewReply('Writer analysis.')]],
  ]));

  const result = await runCouncilSequence(
    session,
    session.conversationId,
    [leader, critic, writer],
    TEST_LLM_ID,
    1,
    history[0].id,
    initialCouncilState,
    runtime,
  );

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [leader.id, critic.id, writer.id]);
  const resultMessage = history.find(message => message.metadata?.council?.kind === 'result') ?? null;
  assert.ok(resultMessage);
  assert.equal(messageFragmentsReduceText(resultMessage!.fragments), 'Finished draft.');
});

test('runCouncilSequence gives the leader prior-round rejection context before drafting round 2', async () => {
  const [leader, critic, writer] = createParticipants();
  const history = [createDMessageTextContent('user', 'Answer the user clearly.')];
  const session = createSession(history);
  const runtime = new ScriptedRuntime(new Map([
    [leader.id, ['Draft one.', 'Draft two, revised.']],
    [critic.id, [
      scriptedCouncilRejectReviewReply('Needs concrete implementation detail.', 'Needs concrete implementation detail.'),
      scriptedCouncilAcceptReviewReply('The revision fixes the missing detail.'),
    ]],
    [writer.id, [
      scriptedCouncilAcceptReviewReply('The first draft is clear enough.'),
      scriptedCouncilAcceptReviewReply('The revision is ready.'),
    ]],
  ]));

  const result = await runCouncilSequence(
    session,
    session.conversationId,
    [leader, critic, writer],
    TEST_LLM_ID,
    2,
    history[0].id,
    null,
    runtime,
  );

  assert.equal(result, true);
  assert.deepEqual(runtime.callLog, [
    leader.id,
    critic.id,
    writer.id,
    leader.id,
    critic.id,
    writer.id,
  ]);

  const leaderSecondRoundHistory = runtime.historyLog
    .filter(entry => entry.participantId === leader.id)[1]?.sourceHistory ?? [];
  const leaderSecondRoundText = leaderSecondRoundHistory
    .flatMap(message => message.fragments)
    .map(fragment => 'part' in fragment && 'text' in fragment.part ? fragment.part.text : '')
    .filter(Boolean)
    .join('\n\n');

  assert.match(leaderSecondRoundText, /You are revising the council proposal for round 2\./);
  assert.match(leaderSecondRoundText, /Shared rejection reasons to address:/);
  assert.match(leaderSecondRoundText, /Needs concrete implementation detail\./);
  assert.match(leaderSecondRoundText, /Leader proposal:\nDraft one\./);
  assert.match(leaderSecondRoundText, /Reject: Needs concrete implementation detail\./);
});
