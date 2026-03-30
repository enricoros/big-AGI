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
import { createModelAuxVoidFragment, createTextContentFragment, create_FunctionCallInvocation_ContentFragment, create_FunctionCallResponse_ContentFragment, isToolResponseFunctionCallPart } from '~/common/stores/chat/chat.fragments';


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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

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
      getState: () => ephemeral.state,
      getText: () => ephemeral.text,
      replaceWithExisting: (parentToolInvocationId: string, state: object) => {
        const existingEphemeral = this.ephemerals.find((candidate) =>
          candidate !== ephemeral &&
          (candidate.state as { parentToolInvocationId?: unknown })?.parentToolInvocationId === parentToolInvocationId,
        );
        if (!existingEphemeral)
          return false;

        existingEphemeral.text = ephemeral.text;
        existingEphemeral.state = state;
        const index = this.ephemerals.indexOf(ephemeral);
        if (index >= 0)
          this.ephemerals.splice(index, 1);
        return true;
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
        createModelAuxVoidFragment('reasoning', 'Need to inspect the edge case first.'),
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
  assert.deepEqual(calls.map(call => call.requestedToolNames), [
    ['WebSearch', 'subagent'],
    ['WebSearch'],
    ['WebSearch', 'subagent'],
  ]);
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
  assert.match(session.ephemerals[0]?.text ?? '', /\*\*Task\*\*/);
  assert.match(session.ephemerals[0]?.text ?? '', /Check the edge case\./);
  assert.match(session.ephemerals[0]?.text ?? '', /The delegated edge case is covered\./);
  assert.equal(Array.isArray((session.ephemerals[0]?.state as { messageFragments?: unknown })?.messageFragments), true);
  assert.equal(((session.ephemerals[0]?.state as { messageFragments?: DMessageFragment[] })?.messageFragments ?? [])[0]?.ft, 'void');
  assert.equal((session.ephemerals[0]?.state as { parentMessageId?: string })?.parentMessageId, 'assistant-1');
  assert.equal((session.ephemerals[0]?.state as { parentToolInvocationId?: string })?.parentToolInvocationId, 'tool-1');
});

test('runPersonaWithEphemeralSubagents runs sibling subagent tool calls concurrently while preserving response order', async () => {
  const session = new FakeSession();
  const firstDeferred = createDeferred<PersonaRunResult>();
  const secondDeferred = createDeferred<PersonaRunResult>();
  const startedPrompts: string[] = [];

  const executePersona = async (params: ChatExecutionRuntimeRunPersonaParams): Promise<PersonaRunResult> => {
    const sourceHistoryText = (params.sourceHistory ?? [])
      .map(message => message.fragments.map(fragment => 'part' in fragment && fragment.part.pt === 'text' ? fragment.part.text : '').filter(Boolean).join('\n'))
      .filter(Boolean)
      .join('\n\n');

    if (sourceHistoryText.includes('First delegated task.')) {
      startedPrompts.push('first');
      return firstDeferred.promise;
    }

    if (sourceHistoryText.includes('Second delegated task.')) {
      startedPrompts.push('second');
      return secondDeferred.promise;
    }

    if (sourceHistoryText.includes('Solve the task.')) {
      return {
        success: true,
        finalMessage: createFinalMessage([
          create_FunctionCallInvocation_ContentFragment('tool-1', 'subagent', JSON.stringify({ prompt: 'First delegated task.' })),
          create_FunctionCallInvocation_ContentFragment('tool-2', 'subagent', JSON.stringify({ prompt: 'Second delegated task.' })),
        ]),
        assistantMessageId: 'assistant-root',
      };
    }

    return {
      success: true,
      finalMessage: createFinalMessage([
        createTextContentFragment('Merged final answer.'),
      ]),
      assistantMessageId: 'assistant-root',
    };
  };

  const runPromise = runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
  }, executePersona);

  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(startedPrompts, ['first', 'second']);

  secondDeferred.resolve({
    success: true,
    finalMessage: createFinalMessage([
      createTextContentFragment('Second result.'),
    ]),
    assistantMessageId: null,
  });

  await Promise.resolve();

  assert.equal(session.ephemerals.length, 2);
  assert.match(session.ephemerals[0]?.text ?? '', /First delegated task\./);
  assert.match(session.ephemerals[1]?.text ?? '', /Second delegated task\./);

  firstDeferred.resolve({
    success: true,
    finalMessage: createFinalMessage([
      createTextContentFragment('First result.'),
    ]),
    assistantMessageId: null,
  });

  const result = await runPromise;
  const toolResponses = result.finalMessage.fragments
    .filter(fragment => fragment.ft === 'content' && isToolResponseFunctionCallPart(fragment.part))
    .map(fragment => JSON.parse(fragment.part.response.result));

  assert.deepEqual(toolResponses, [
    { ok: true, message: 'First result.' },
    { ok: true, message: 'Second result.' },
  ]);
  assert.ok(session.ephemerals.every(ephemeral => ephemeral.done));
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
  assert.deepEqual(calls.map(call => call.requestedToolNames), [
    ['WebSearch', 'subagent'],
    ['WebSearch'],
    ['WebSearch'],
    ['WebSearch'],
    ['WebSearch', 'subagent'],
  ]);
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

test('runPersonaWithEphemeralSubagents tolerates streamed child updates without fragments', async () => {
  const session = new FakeSession();
  let rootCallCount = 0;
  let childCallCount = 0;

  const executePersona = async (params: ChatExecutionRuntimeRunPersonaParams): Promise<PersonaRunResult> => {
    const sourceHistoryText = (params.sourceHistory ?? [])
      .map(message => message.fragments.map(fragment => 'part' in fragment && fragment.part.pt === 'text' ? fragment.part.text : '').filter(Boolean).join('\n'))
      .filter(Boolean)
      .join('\n\n');

    if (sourceHistoryText.includes('Delegated task from your parent agent:')) {
      childCallCount++;
      params.runOptions?.onStreamUpdate?.({
        generator: { mgt: 'named', name: TEST_LLM_ID },
        pendingIncomplete: true,
      } as PersonaRunResult['finalMessage'], false);

      return {
        success: true,
        finalMessage: createFinalMessage([
          createTextContentFragment('Child final output.'),
        ]),
        assistantMessageId: null,
      };
    }

    rootCallCount++;
    if (rootCallCount === 1) {
      return {
        success: true,
        finalMessage: createFinalMessage([
          create_FunctionCallInvocation_ContentFragment('tool-1', 'subagent', JSON.stringify({ prompt: 'Handle the delegated task.' })),
        ]),
        assistantMessageId: 'assistant-root',
      };
    }

    return {
      success: true,
      finalMessage: createFinalMessage([
        createTextContentFragment('Parent final output.'),
      ]),
      assistantMessageId: 'assistant-root',
    };
  };

  const result = await runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
  }, executePersona);

  assert.equal(childCallCount, 1);
  assert.equal(rootCallCount, 2);
  assert.equal(result.finalMessage.fragments.at(-1)?.part.pt, 'text');
  assert.match(session.ephemerals[0]?.text ?? '', /Child final output\./);
});

test('runPersonaWithEphemeralSubagents instructs child agents to send a final visible reply after delegated tools', async () => {
  const session = new FakeSession();
  const capturedHistoryTexts: string[] = [];

  const executePersona = async (params: ChatExecutionRuntimeRunPersonaParams): Promise<PersonaRunResult> => {
    const sourceHistoryText = (params.sourceHistory ?? [])
      .map(message => message.fragments.map(fragment => 'part' in fragment && fragment.part.pt === 'text' ? fragment.part.text : '').filter(Boolean).join('\n'))
      .filter(Boolean)
      .join('\n\n');

    capturedHistoryTexts.push(sourceHistoryText);

    if (sourceHistoryText.includes('Delegated task from your parent agent:')) {
      return {
        success: true,
        finalMessage: createFinalMessage([
          createTextContentFragment('Child final output.'),
        ]),
        assistantMessageId: null,
      };
    }

    return {
      success: true,
      finalMessage: createFinalMessage([
        create_FunctionCallInvocation_ContentFragment('tool-1', 'subagent', JSON.stringify({ prompt: 'Investigate and report back.' })),
      ]),
      assistantMessageId: 'assistant-root',
    };
  };

  await runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
  }, executePersona);

  const childHistoryText = capturedHistoryTexts.find(text => text.includes('Delegated task from your parent agent:')) ?? '';
  assert.match(childHistoryText, /must still send a final visible assistant reply/i);
  assert.match(childHistoryText, /Do not stop after a tool result or internal progress update\./);
});

test('runPersonaWithEphemeralSubagents converts tool-follow-up history to a user turn for providers that reject assistant prefill', async () => {
  const session = new FakeSession();
  const capturedRoles: Array<Array<DMessage['role']>> = [];

  const executePersona = async (params: ChatExecutionRuntimeRunPersonaParams): Promise<PersonaRunResult> => {
    capturedRoles.push((params.sourceHistory ?? []).map(message => message.role));

    const hasDelegatedPrompt = (params.sourceHistory ?? []).some(message =>
      message.fragments.some(fragment => 'part' in fragment && fragment.part.pt === 'text' && fragment.part.text.includes('Delegated task from your parent agent:')),
    );

    if (hasDelegatedPrompt) {
      return {
        success: true,
        finalMessage: createFinalMessage([
          createTextContentFragment('Child final output.'),
        ]),
        assistantMessageId: null,
      };
    }

    if (capturedRoles.length === 1) {
      return {
        success: true,
        finalMessage: createFinalMessage([
          create_FunctionCallInvocation_ContentFragment('tool-1', 'subagent', JSON.stringify({ prompt: 'Handle the delegated task.' })),
        ]),
        assistantMessageId: 'assistant-root',
      };
    }

    return {
      success: true,
      finalMessage: createFinalMessage([
        createTextContentFragment('Parent final output.'),
      ]),
      assistantMessageId: 'assistant-root',
    };
  };

  const result = await runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
  }, executePersona);

  assert.deepEqual(capturedRoles, [
    ['user'],
    ['user', 'user'],
    ['user', 'user'],
  ]);
  assert.equal(result.finalMessage.fragments.at(-1)?.part.pt, 'text');
});

test('runPersonaWithEphemeralSubagents trims trailing whitespace from tool-follow-up text history', async () => {
  const session = new FakeSession();
  const calls: ExecutorCall[] = [];

  const executePersona = createScriptedExecutor(session, calls, [
    {
      assistantMessageId: 'assistant-root',
      fragments: [
        create_FunctionCallInvocation_ContentFragment('tool-1', 'subagent', JSON.stringify({ prompt: 'Handle the delegated task.' })),
        createTextContentFragment('Trailing whitespace from assistant.   \n\n'),
      ],
    },
    {
      fragments: [
        createTextContentFragment('Child final output.'),
      ],
    },
    {
      assistantMessageId: 'assistant-root',
      fragments: [
        createTextContentFragment('Parent final output.'),
      ],
    },
  ]);

  await runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
  }, executePersona);

  assert.equal(calls[2]?.sourceHistoryText, 'Solve the task.\n\nTrailing whitespace from assistant.');
});

test('runPersonaWithEphemeralSubagents uses the user-terminated follow-up history in the final fallback execution path', async () => {
  const session = new FakeSession();
  const capturedHistories: string[] = [];
  let rootCallCount = 0;

  const executePersona = async (params: ChatExecutionRuntimeRunPersonaParams): Promise<PersonaRunResult> => {
    const historyText = (params.sourceHistory ?? [])
      .map(message => message.fragments.map(fragment => 'part' in fragment && fragment.part.pt === 'text' ? fragment.part.text : '').filter(Boolean).join('\n'))
      .filter(Boolean)
      .join('\n\n');
    capturedHistories.push(historyText);

    const hasDelegatedPrompt = historyText.includes('Delegated task from your parent agent:');
    if (hasDelegatedPrompt) {
      return {
        success: true,
        finalMessage: createFinalMessage([
          createTextContentFragment('Child final output.'),
        ]),
        assistantMessageId: null,
      };
    }

    rootCallCount++;
    if (rootCallCount === 1) {
      return {
        success: true,
        finalMessage: createFinalMessage([
          create_FunctionCallInvocation_ContentFragment('tool-1', 'subagent', JSON.stringify({ prompt: 'Handle the delegated task.' })),
        ]),
        assistantMessageId: 'assistant-root',
      };
    }

    return {
      success: true,
      finalMessage: createFinalMessage([
        createTextContentFragment('Fallback final output.'),
      ]),
      assistantMessageId: 'assistant-root',
    };
  };

  const result = await runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
  }, executePersona, { depth: 8 });

  assert.equal(result.finalMessage.fragments.at(-1)?.part.pt, 'text');
  assert.deepEqual(capturedHistories, [
    'Solve the task.',
    'Solve the task.',
  ]);
});

test('runPersonaWithEphemeralSubagents does not re-execute historical subagent invocations that already have responses', async () => {
  const session = new FakeSession();
  const executePersona = async (params: ChatExecutionRuntimeRunPersonaParams): Promise<PersonaRunResult> => {
    const sourceHistoryText = (params.sourceHistory ?? [])
      .map(message => message.fragments.map(fragment => 'part' in fragment && fragment.part.pt === 'text' ? fragment.part.text : '').filter(Boolean).join('\n'))
      .filter(Boolean)
      .join('\n\n');

    if (sourceHistoryText.includes('Delegated task from your parent agent:'))
      throw new Error('Historical subagent invocation was replayed unexpectedly');

    return {
      success: true,
      finalMessage: createFinalMessage([
        create_FunctionCallInvocation_ContentFragment('tool-1', 'subagent', JSON.stringify({ prompt: 'Fresh delegated task.' })),
        create_FunctionCallResponse_ContentFragment('tool-1', false, 'subagent', JSON.stringify({ ok: true, message: 'Already done.' }), 'client'),
        createTextContentFragment('Parent final output.'),
      ]),
      assistantMessageId: 'assistant-root',
    };
  };

  const result = await runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
  }, executePersona);

  assert.equal(result.finalMessage.fragments.at(-1)?.part.pt, 'text');
  assert.equal(session.ephemerals.length, 0);
});

test('runPersonaWithEphemeralSubagents does not create duplicate ephemerals for the same subagent invocation id', async () => {
  const session = new FakeSession();
  const calls: ExecutorCall[] = [];
  let childGate = createDeferred<void>();
  let childRuns = 0;

  const executePersona = async (params: ChatExecutionRuntimeRunPersonaParams): Promise<PersonaRunResult> => {
    calls.push({
      createPlaceholder: params.createPlaceholder,
      requestedToolNames: collectRequestedToolNames(params),
      sourceHistoryText: (params.sourceHistory ?? [])
        .map(message => message.fragments.map(fragment => 'part' in fragment && fragment.part.pt === 'text' ? fragment.part.text : '').filter(Boolean).join('\n'))
        .filter(Boolean)
        .join('\n\n'),
    });

    const sourceHistoryText = calls.at(-1)?.sourceHistoryText ?? '';
    if (sourceHistoryText.includes('Delegated task from your parent agent:')) {
      childRuns++;
      await childGate.promise;
      return {
        success: true,
        finalMessage: createFinalMessage([
          createTextContentFragment(`Child final output ${childRuns}.`),
        ]),
        assistantMessageId: null,
      };
    }

    if (calls.length === 1) {
      return {
        success: true,
        finalMessage: createFinalMessage([
          create_FunctionCallInvocation_ContentFragment('tool-1', 'subagent', JSON.stringify({ prompt: 'Handle once.' })),
        ]),
        assistantMessageId: 'assistant-root',
      };
    }

    return {
      success: true,
      finalMessage: createFinalMessage([
        create_FunctionCallInvocation_ContentFragment('tool-1', 'subagent', JSON.stringify({ prompt: 'Handle once.' })),
      ]),
      assistantMessageId: 'assistant-root',
    };
  };

  const firstRunPromise = runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
  }, executePersona);

  await new Promise(resolve => setTimeout(resolve, 0));

  const secondRunPromise = runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
  }, executePersona);

  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(session.ephemerals.length, 1);
  assert.equal((session.ephemerals[0]?.state as { parentToolInvocationId?: string })?.parentToolInvocationId, 'tool-1');

  childGate.resolve();
  await Promise.all([firstRunPromise, secondRunPromise]);

  assert.equal(childRuns, 1);
});

test('runPersonaWithEphemeralSubagents stops the tool loop when the assistant message ends with a terminal provider error', async () => {
  const session = new FakeSession();
  let rootCalls = 0;
  let childCalls = 0;

  const executePersona = async (params: ChatExecutionRuntimeRunPersonaParams): Promise<PersonaRunResult> => {
    const sourceHistoryText = (params.sourceHistory ?? [])
      .map(message => message.fragments.map(fragment => 'part' in fragment && fragment.part.pt === 'text' ? fragment.part.text : '').filter(Boolean).join('\n'))
      .filter(Boolean)
      .join('\n\n');

    if (sourceHistoryText.includes('Delegated task from your parent agent:')) {
      childCalls++;
      return {
        success: false,
        finalMessage: createFinalMessage([
          createTextContentFragment('Child should not be called after terminal error.'),
        ]),
        assistantMessageId: null,
      };
    }

    rootCalls++;
    return {
      success: false,
      finalMessage: createFinalMessage([
        create_FunctionCallInvocation_ContentFragment('tool-1', 'subagent', JSON.stringify({ prompt: 'Should not execute.' })),
        {
          fId: 'error-1',
          ft: 'content',
          part: {
            pt: 'error',
            error: '[Service Issue] Openai: Upstream responded with HTTP 400 - Request contains an invalid argument.',
          },
        },
      ] as DMessageFragment[]),
      assistantMessageId: 'assistant-root',
    };
  };

  const result = await runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
  }, executePersona);

  assert.equal(rootCalls, 1);
  assert.equal(childCalls, 0);
  assert.equal(result.finalMessage.fragments.at(-1)?.part.pt, 'error');
  assert.equal(session.ephemerals.length, 0);
});

test('runPersonaWithEphemeralSubagents does not append a duplicate terminal provider error over an existing assistant message', async () => {
  const session = new FakeSession();
  const existingAssistant = createDMessageEmpty('assistant');
  existingAssistant.id = 'assistant-root';
  existingAssistant.fragments = [{
    fId: 'error-existing',
    ft: 'content',
    part: {
      pt: 'error',
      error: '[Service Issue] Openai: Upstream responded with HTTP 400 - Request contains an invalid argument.',
    },
  }];
  session.messages.set(existingAssistant.id, structuredClone(existingAssistant));

  let executeCalls = 0;
  const executePersona = async (): Promise<PersonaRunResult> => {
    executeCalls++;
    return {
      success: false,
      finalMessage: createFinalMessage([
        {
          fId: 'error-existing',
          ft: 'content',
          part: {
            pt: 'error',
            error: '[Service Issue] Openai: Upstream responded with HTTP 400 - Request contains an invalid argument.',
          },
        },
      ] as DMessageFragment[]),
      assistantMessageId: 'assistant-root',
    };
  };

  const result = await runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
    runOptions: {
      existingAssistantMessageId: 'assistant-root',
    },
  }, executePersona);

  assert.equal(executeCalls, 1);
  assert.equal(session.messageEdits.length, 0);
  assert.equal(result.finalMessage.fragments.length, 1);
  assert.equal(result.finalMessage.fragments[0]?.part.pt, 'error');
});

test('runPersonaWithEphemeralSubagents disables subagent delegation inside child delegated runs', async () => {
  const session = new FakeSession();
  const requestedToolNamesByCall: string[][] = [];

  const executePersona = async (params: ChatExecutionRuntimeRunPersonaParams): Promise<PersonaRunResult> => {
    requestedToolNamesByCall.push(collectRequestedToolNames(params));

    const sourceHistoryText = (params.sourceHistory ?? [])
      .map(message => message.fragments.map(fragment => 'part' in fragment && fragment.part.pt === 'text' ? fragment.part.text : '').filter(Boolean).join('\n'))
      .filter(Boolean)
      .join('\n\n');

    if (sourceHistoryText.includes('Delegated task from your parent agent:')) {
      return {
        success: true,
        finalMessage: createFinalMessage([
          createTextContentFragment('Child final output.'),
        ]),
        assistantMessageId: null,
      };
    }

    return {
      success: true,
      finalMessage: createFinalMessage([
        create_FunctionCallInvocation_ContentFragment('tool-1', 'subagent', JSON.stringify({ prompt: 'Handle delegated task.' })),
      ]),
      assistantMessageId: 'assistant-root',
    };
  };

  await runPersonaWithEphemeralSubagents({
    ...createBaseParams(session),
    createPlaceholder: false,
  }, executePersona);

  assert.deepEqual(requestedToolNamesByCall, [
    ['WebSearch', 'subagent'],
    ['WebSearch'],
    ['WebSearch', 'subagent'],
  ]);
});
