import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChatExecutionRuntimeRunPersonaParams, ChatExecutionSession, ChatExecutionEphemeralHandle } from './chat-execution.runtime';
import { runPersonaWithEphemeralSubagents } from './chat-execution.runtime.tools';
import type { PersonaRunResult } from './chat-persona';

import { createAssistantConversationParticipant, createDConversation } from '~/common/stores/chat/chat.conversation';
import type { DMessageGenerator } from '~/common/stores/chat/chat.message';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { createDMessageEmpty, createDMessageTextContent } from '~/common/stores/chat/chat.message';
import type { DMessageFragment } from '~/common/stores/chat/chat.fragments';
import { createTextContentFragment, create_FunctionCallInvocation_ContentFragment, isToolResponseFunctionCallPart } from '~/common/stores/chat/chat.fragments';


const TEST_LLM_ID = 'test-llm';

type ExecutorCall = {
  createPlaceholder: boolean | undefined;
  requestedToolNames: string[];
  sourceHistoryText: string;
};

type ScriptedReply = {
  assistantMessageId?: string | null;
  success?: boolean;
  fragments: DMessageFragment[];
};

class FakeSession implements ChatExecutionSession {
  readonly conversationId = createDConversation().id;
  readonly messages = new Map<string, DMessage>();
  readonly messageEdits: Array<{ messageId: string; messageComplete: boolean }> = [];
  readonly appendedFragments: Array<{ messageId: string; fragment: DMessageFragment }> = [];
  readonly ephemerals: Array<{ title: string; text: string; state: object; done: boolean }> = [];

  historyViewHeadOrThrow(): Readonly<DMessage[]> {
    return [];
  }

  historyFindMessageOrThrow(messageId: string): Readonly<DMessage> | undefined {
    return this.messages.get(messageId);
  }

  historyClear(): void {
    this.messages.clear();
  }

  messageAppend(message: DMessage): void {
    this.messages.set(message.id, structuredClone(message));
  }

  messageAppendAssistantText(): void {
  }

  messageAppendAssistantPlaceholder(): { assistantMessageId: string; placeholderFragmentId: string } {
    throw new Error('Not used in this test');
  }

  messageEdit(messageId: string, update: Partial<DMessage> | ((message: DMessage) => Partial<DMessage>), messageComplete: boolean): void {
    const existing = this.messages.get(messageId) ?? createDMessageEmpty('assistant');
    existing.id = messageId;
    const nextUpdate = typeof update === 'function' ? update(existing) : update;
    Object.assign(existing, structuredClone(nextUpdate));
    this.messages.set(messageId, existing);
    this.messageEdits.push({ messageId, messageComplete });
  }

  messageFragmentAppend(messageId: string, fragment: DMessageFragment): void {
    const existing = this.messages.get(messageId) ?? createDMessageEmpty('assistant');
    existing.id = messageId;
    existing.fragments = [...existing.fragments, structuredClone(fragment)];
    this.messages.set(messageId, existing);
    this.appendedFragments.push({ messageId, fragment: structuredClone(fragment) });
  }

  messageFragmentDelete(): void {
  }

  messageFragmentReplace(): void {
  }

  beamInvoke(): void {
  }

  createEphemeralHandler(title: string, initialText: string): ChatExecutionEphemeralHandle {
    const ephemeral = {
      title,
      text: initialText,
      state: {},
      done: false,
    };
    this.ephemerals.push(ephemeral);
    return {
      updateText: (text: string) => {
        ephemeral.text = text;
      },
      updateState: (state: object) => {
        ephemeral.state = state;
      },
      markAsDone: () => {
        ephemeral.done = true;
      },
    };
  }

  setAbortController(): void {
  }

  clearAbortController(): void {
  }

  getCouncilSession() {
    throw new Error('Not used in this test');
  }

  setCouncilSession(): void {
  }

  updateCouncilSession(): void {
  }

  resetCouncilSession(): void {
  }

  persistCouncilState(): void {
  }
}

function createFinalMessage(fragments: DMessageFragment[], generatorName: string = TEST_LLM_ID): PersonaRunResult['finalMessage'] {
  return {
    fragments: structuredClone(fragments),
    generator: { mgt: 'named', name: generatorName } satisfies DMessageGenerator,
    pendingIncomplete: false,
  };
}

function collectRequestedToolNames(params: ChatExecutionRuntimeRunPersonaParams): string[] {
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
}

function createScriptedExecutor(
  session: FakeSession,
  calls: ExecutorCall[],
  replies: ScriptedReply[],
) {
  return async (params: ChatExecutionRuntimeRunPersonaParams): Promise<PersonaRunResult> => {
    calls.push({
      createPlaceholder: params.createPlaceholder,
      requestedToolNames: collectRequestedToolNames(params),
      sourceHistoryText: (params.sourceHistory ?? [])
        .map(message => message.fragments.map(fragment => 'part' in fragment && fragment.part.pt === 'text' ? fragment.part.text : '').filter(Boolean).join('\n'))
        .filter(Boolean)
        .join('\n\n'),
    });

    const nextReply = replies.shift();
    if (!nextReply)
      throw new Error('Missing scripted reply');

    if (nextReply.assistantMessageId) {
      const assistantMessage = createDMessageEmpty('assistant');
      assistantMessage.id = nextReply.assistantMessageId;
      assistantMessage.fragments = structuredClone(nextReply.fragments);
      session.messages.set(assistantMessage.id, assistantMessage);
    }

    return {
      success: nextReply.success ?? true,
      finalMessage: createFinalMessage(nextReply.fragments),
      assistantMessageId: nextReply.assistantMessageId ?? null,
    };
  };
}

function createBaseParams(session: FakeSession): ChatExecutionRuntimeRunPersonaParams {
  const participant = createAssistantConversationParticipant('Developer', TEST_LLM_ID, 'Leader', 'every-turn', true);
  return {
    assistantLlmId: TEST_LLM_ID,
    conversationId: session.conversationId,
    systemPurposeId: 'Developer',
    participant,
    sourceHistory: [createDMessageTextContent('user', 'Solve the task.')],
    createPlaceholder: true,
    messageChannel: { channel: 'public-board' },
    runOptions: {},
    session,
  };
}

test('runPersonaWithEphemeralSubagents executes subagent tool calls and continues the same turn', async () => {
  const session = new FakeSession();
  const calls: ExecutorCall[] = [];
  const executePersona = createScriptedExecutor(session, calls, [
    {
      assistantMessageId: 'assistant-1',
      fragments: [
        create_FunctionCallInvocation_ContentFragment('tool-1', 'subagent', JSON.stringify({ prompt: 'Check the edge case.' })),
      ],
    },
    {
      fragments: [
        createTextContentFragment('The delegated edge case is covered.'),
      ],
    },
    {
      fragments: [
        createTextContentFragment('Final answer for the user.'),
      ],
    },
  ]);

  const result = await runPersonaWithEphemeralSubagents(createBaseParams(session), executePersona);

  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => call.requestedToolNames.includes('subagent')));
  assert.match(calls[1]?.sourceHistoryText ?? '', /Delegated task from your parent agent:/);

  assert.deepEqual(result.finalMessage.fragments.map(fragment => fragment.part.pt), [
    'tool_invocation',
    'tool_response',
    'text',
  ]);

  const toolResponse = result.finalMessage.fragments[1];
  assert.ok(toolResponse && toolResponse.ft === 'content' && isToolResponseFunctionCallPart(toolResponse.part));
  assert.deepEqual(JSON.parse(toolResponse.part.response.result), {
    ok: true,
    message: 'The delegated edge case is covered.',
  });

  assert.equal(session.appendedFragments.length, 1);
  assert.equal(session.ephemerals.length, 1);
  assert.equal(session.ephemerals[0]?.done, true);
  assert.match(session.ephemerals[0]?.text ?? '', /delegated edge case/i);
});

test('runPersonaWithEphemeralSubagents lets nested subagents inherit the same toolset', async () => {
  const session = new FakeSession();
  const calls: ExecutorCall[] = [];
  const executePersona = createScriptedExecutor(session, calls, [
    {
      fragments: [
        create_FunctionCallInvocation_ContentFragment('tool-parent', 'subagent', JSON.stringify({ prompt: 'Do a deeper pass.' })),
      ],
    },
    {
      fragments: [
        create_FunctionCallInvocation_ContentFragment('tool-child', 'subagent', JSON.stringify({ prompt: 'Inspect the hidden constraint.' })),
      ],
    },
    {
      fragments: [
        createTextContentFragment('Hidden constraint found.'),
      ],
    },
    {
      fragments: [
        createTextContentFragment('Child synthesized the hidden constraint.'),
      ],
    },
    {
      fragments: [
        createTextContentFragment('Parent final answer.'),
      ],
    },
  ]);

  const result = await runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
  }, executePersona);

  assert.equal(calls.length, 5);
  assert.ok(calls.every(call => call.requestedToolNames.includes('subagent')));
  assert.equal(session.ephemerals.length, 2);
  assert.ok(session.ephemerals.every(ephemeral => ephemeral.done));

  const toolResponses = result.finalMessage.fragments
    .filter(fragment => fragment.ft === 'content' && isToolResponseFunctionCallPart(fragment.part))
    .map(fragment => JSON.parse(fragment.part.response.result));
  assert.deepEqual(toolResponses, [{
    ok: true,
    message: 'Child synthesized the hidden constraint.',
  }]);
  assert.equal(result.finalMessage.fragments.at(-1)?.part.pt, 'text');
});
