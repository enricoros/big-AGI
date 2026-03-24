import * as z from 'zod/v4';

import type { ChatExecutionRuntimeRunPersonaParams, ChatExecutionSession } from './chat-execution.runtime';
import type { PersonaRunResult, PersonaRunOptions } from './chat-persona';
import { applyMessageChannelScope } from './chat-persona';

import { aixFunctionCallTool } from '~/modules/aix/client/aix.client.fromSimpleFunction';

import type { DMessage } from '~/common/stores/chat/chat.message';
import { createDMessageEmpty, createDMessageTextContent, duplicateDMessage, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import type { DMessageContentFragment, DMessageToolInvocationPart } from '~/common/stores/chat/chat.fragments';
import { create_FunctionCallResponse_ContentFragment, isContentFragment, isToolInvocationPart, isToolResponseFunctionCallPart } from '~/common/stores/chat/chat.fragments';


const SUBAGENT_TOOL_NAME = 'subagent';
const SUBAGENT_MAX_DEPTH = 4;
const SUBAGENT_MAX_TOOL_ROUNDS = 8;

const subagentTool = {
  name: SUBAGENT_TOOL_NAME,
  description: 'Delegate a bounded task to an ephemeral subagent that shares your context and available tools. The subagent returns one message.',
  inputSchema: z.object({
    prompt: z.string().trim().min(1),
  }),
} as const;

type ToolLoopContext = {
  depth: number;
};

type ToolHandlerResult = {
  error: boolean | string;
  result: string;
};

type FunctionToolInvocation = DMessageToolInvocationPart & {
  invocation: Extract<DMessageToolInvocationPart['invocation'], { type: 'function_call' }>;
};

type ToolHandler = (invocation: FunctionToolInvocation, sourceHistory: Readonly<DMessage[]>) => Promise<ToolHandlerResult>;

type PersonaExecutor = (params: ChatExecutionRuntimeRunPersonaParams) => Promise<PersonaRunResult>;

function composeRequestTransforms(
  baseTransform: PersonaRunOptions['requestTransform'] | undefined,
  nextTransform: NonNullable<PersonaRunOptions['requestTransform']>,
): PersonaRunOptions['requestTransform'] {
  return request => nextTransform(baseTransform ? baseTransform(request) : request);
}

function createSubagentRequestTransform(): NonNullable<PersonaRunOptions['requestTransform']> {
  return request => {
    const existingTools = request.tools ?? [];
    const hasSubagentTool = existingTools.some(tool =>
      tool.type === 'function_call' && tool.function_call.name === SUBAGENT_TOOL_NAME,
    );

    return hasSubagentTool
      ? request
      : {
          ...request,
          tools: [...existingTools, aixFunctionCallTool(subagentTool)],
        };
  };
}

function getPendingClientToolInvocations(
  fragments: DMessage['fragments'],
  executableToolNames: ReadonlySet<string>,
): FunctionToolInvocation[] {
  const contentFragments = fragments.filter((fragment): fragment is DMessageContentFragment => isContentFragment(fragment));
  const respondedIds = new Set<string>();
  const pendingInvocations: FunctionToolInvocation[] = [];

  for (const fragment of contentFragments) {
    if (isToolResponseFunctionCallPart(fragment.part))
      respondedIds.add(fragment.part.id);
  }

  for (const fragment of contentFragments) {
    if (!isToolInvocationPart(fragment.part) || fragment.part.invocation.type !== 'function_call')
      continue;
    if (!executableToolNames.has(fragment.part.invocation.name) || respondedIds.has(fragment.part.id))
      continue;
    pendingInvocations.push(fragment.part as FunctionToolInvocation);
  }

  return pendingInvocations;
}

function buildAssistantHistoryMessage(params: {
  participant: ChatExecutionRuntimeRunPersonaParams['participant'];
  assistantLlmId: ChatExecutionRuntimeRunPersonaParams['assistantLlmId'];
  message: PersonaRunResult['finalMessage'];
  messageChannel: ChatExecutionRuntimeRunPersonaParams['messageChannel'];
}): DMessage {
  const assistantMessage = createDMessageEmpty('assistant');
  assistantMessage.fragments = structuredClone(params.message.fragments);
  assistantMessage.generator = structuredClone(params.message.generator);
  assistantMessage.pendingIncomplete = params.message.pendingIncomplete;
  assistantMessage.metadata = {
    ...assistantMessage.metadata,
    ...(params.participant ? {
      author: {
        participantId: params.participant.id,
        participantName: params.participant.name,
        personaId: params.participant.personaId,
        llmId: params.participant.llmId ?? params.assistantLlmId,
      },
    } : {}),
  };
  if (params.messageChannel)
    applyMessageChannelScope(assistantMessage, params.messageChannel);
  assistantMessage.updated = assistantMessage.created;
  return assistantMessage;
}

function mergeFinalMessages(prefix: PersonaRunResult['finalMessage'], suffix: PersonaRunResult['finalMessage']): PersonaRunResult['finalMessage'] {
  return {
    fragments: [
      ...structuredClone(prefix.fragments),
      ...structuredClone(suffix.fragments),
    ],
    generator: structuredClone(suffix.generator),
    pendingIncomplete: suffix.pendingIncomplete,
  };
}

function updateAssistantMessageFromFinalMessage(
  session: ChatExecutionSession,
  assistantMessageId: string,
  message: PersonaRunResult['finalMessage'],
  messageComplete: boolean,
): void {
  session.messageEdit(assistantMessageId, {
    fragments: structuredClone(message.fragments),
    generator: structuredClone(message.generator),
    pendingIncomplete: message.pendingIncomplete,
  }, messageComplete, false);
}

function createSubagentUserMessage(prompt: string): DMessage {
  return createDMessageTextContent('user', [
    'Delegated task from your parent agent:',
    prompt.trim(),
    '',
    'You are an ephemeral subagent.',
    'Work only on the delegated task using the shared conversation context and the same available tools.',
    'Return only the result your parent agent should use next.',
  ].join('\n'));
}

function createSubagentToolHandlers(
  params: ChatExecutionRuntimeRunPersonaParams,
  executePersona: PersonaExecutor,
  context: ToolLoopContext,
  abortController: AbortController,
): Map<string, ToolHandler> {
  return new Map<string, ToolHandler>([
    [SUBAGENT_TOOL_NAME, async (invocation, sourceHistory) => {
      if (context.depth >= SUBAGENT_MAX_DEPTH) {
        return {
          error: 'subagent depth limit reached',
          result: JSON.stringify({
            ok: false,
            error: 'Subagent depth limit reached.',
          }),
        };
      }

      let parsedArgs: z.infer<typeof subagentTool.inputSchema>;
      try {
        parsedArgs = subagentTool.inputSchema.parse(JSON.parse(invocation.invocation.args || '{}'));
      } catch (error) {
        return {
          error: 'invalid subagent arguments',
          result: JSON.stringify({
            ok: false,
            error: error instanceof Error && error.message ? error.message : 'Invalid subagent arguments.',
          }),
        };
      }

      const ephemeral = params.session.createEphemeralHandler(
        params.participant?.name ? `${params.participant.name} subagent` : 'Subagent',
        'Delegating task...',
      );
      ephemeral.updateState({
        depth: context.depth + 1,
        prompt: parsedArgs.prompt,
        status: 'running',
      });

      try {
        const childHistory = [
          ...sourceHistory.map(message => duplicateDMessage(message, false)),
          createSubagentUserMessage(parsedArgs.prompt),
        ];

        const childResult = await runPersonaWithEphemeralSubagents({
          ...params,
          keepAbortController: true,
          sourceHistory: childHistory,
          createPlaceholder: false,
          messageChannel: null,
          runOptions: {
            requestTransform: params.runOptions?.requestTransform,
            llmUserParametersReplacement: params.runOptions?.llmUserParametersReplacement,
          },
        }, executePersona, {
          depth: context.depth + 1,
        }, (message, messageComplete) => {
          const visibleText = messageFragmentsReduceText(message.fragments).trim();
          if (visibleText)
            ephemeral.updateText(visibleText);
          ephemeral.updateState({
            depth: context.depth + 1,
            prompt: parsedArgs.prompt,
            status: messageComplete ? 'finalizing' : 'running',
          });
        });

        const childMessage = messageFragmentsReduceText(childResult.finalMessage.fragments).trim();
        const toolPayload = childMessage
          ? {
              ok: true,
              message: childMessage,
            }
          : {
              ok: childResult.success,
              message: '',
            };

        ephemeral.updateText(childMessage || 'No visible text returned.');
        ephemeral.updateState({
          depth: context.depth + 1,
          prompt: parsedArgs.prompt,
          status: childResult.success ? 'done' : 'failed',
        });

        return {
          error: childResult.success ? false : 'subagent execution failed',
          result: JSON.stringify(toolPayload),
        };
      } catch (error) {
        ephemeral.updateText(error instanceof Error && error.message ? error.message : 'Subagent execution failed.');
        ephemeral.updateState({
          depth: context.depth + 1,
          prompt: parsedArgs.prompt,
          status: 'failed',
        });
        if (abortController.signal.aborted)
          throw error;
        return {
          error: 'subagent execution failed',
          result: JSON.stringify({
            ok: false,
            error: error instanceof Error && error.message ? error.message : 'Subagent execution failed.',
          }),
        };
      } finally {
        ephemeral.markAsDone();
      }
    }],
  ]);
}

export async function runPersonaWithEphemeralSubagents(
  params: ChatExecutionRuntimeRunPersonaParams,
  executePersona: PersonaExecutor,
  context: ToolLoopContext = { depth: 0 },
  onLoopStreamUpdate?: NonNullable<PersonaRunOptions['onStreamUpdate']>,
): Promise<PersonaRunResult> {
  const loopAbortController = params.sharedAbortController ?? new AbortController();
  const managesAbortController = !params.sharedAbortController && !params.keepAbortController;
  const toolHandlers = createSubagentToolHandlers(params, executePersona, context, loopAbortController);
  const executableToolNames = new Set(toolHandlers.keys());
  const baseRequestTransform = composeRequestTransforms(
    params.runOptions?.requestTransform,
    createSubagentRequestTransform(),
  );

  if (managesAbortController)
    params.session.setAbortController(loopAbortController, 'chat-persona-tool-loop');

  try {
    const baseHistory = (params.sourceHistory ?? params.session.historyViewHeadOrThrow('chat-persona-tool-loop-base')) as Readonly<DMessage[]>;
    let currentHistory = baseHistory;
    let assistantMessageId: string | null = params.runOptions?.existingAssistantMessageId ?? null;
    let lastResult: PersonaRunResult | null = null;
    let firstPass = true;

    for (let round = 0; round < SUBAGENT_MAX_TOOL_ROUNDS; round++) {
      const loopPrefix: PersonaRunResult['finalMessage'] | null = lastResult
        ? lastResult.finalMessage
        : null;
      const streamUpdate = !firstPass && loopPrefix
        ? ((message: Parameters<NonNullable<PersonaRunOptions['onStreamUpdate']>>[0], messageComplete: Parameters<NonNullable<PersonaRunOptions['onStreamUpdate']>>[1]) => {
            const mergedMessage = mergeFinalMessages({
              fragments: loopPrefix.fragments,
              generator: loopPrefix.generator,
              pendingIncomplete: false,
            }, {
              fragments: message.fragments,
              generator: message.generator,
              pendingIncomplete: message.pendingIncomplete,
            });
            if (assistantMessageId)
              updateAssistantMessageFromFinalMessage(params.session, assistantMessageId, mergedMessage, messageComplete);
            params.runOptions?.onStreamUpdate?.(mergedMessage, messageComplete);
            onLoopStreamUpdate?.(mergedMessage, messageComplete);
          })
        : (message: Parameters<NonNullable<PersonaRunOptions['onStreamUpdate']>>[0], messageComplete: Parameters<NonNullable<PersonaRunOptions['onStreamUpdate']>>[1]) => {
            params.runOptions?.onStreamUpdate?.(message, messageComplete);
            onLoopStreamUpdate?.(message, messageComplete);
          };

      const runResult = await executePersona({
        ...params,
        keepAbortController: true,
        sharedAbortController: loopAbortController,
        sourceHistory: currentHistory,
        createPlaceholder: firstPass ? params.createPlaceholder : false,
        runOptions: {
          ...params.runOptions,
          requestTransform: baseRequestTransform,
          existingAssistantMessageId: firstPass ? params.runOptions?.existingAssistantMessageId : null,
          existingAssistantUpstreamHandle: firstPass ? params.runOptions?.existingAssistantUpstreamHandle : undefined,
          onStreamUpdate: streamUpdate,
        },
      });

      assistantMessageId = assistantMessageId ?? runResult.assistantMessageId ?? null;
      lastResult = loopPrefix ? {
        ...runResult,
        finalMessage: mergeFinalMessages(loopPrefix, runResult.finalMessage),
      } : runResult;

      if (assistantMessageId && !firstPass)
        updateAssistantMessageFromFinalMessage(params.session, assistantMessageId, lastResult.finalMessage, true);

      const pendingInvocations = getPendingClientToolInvocations(lastResult.finalMessage.fragments, executableToolNames);
      if (!pendingInvocations.length || loopAbortController.signal.aborted)
        return lastResult;

      for (const invocation of pendingInvocations) {
        const handler = toolHandlers.get(invocation.invocation.name);
        if (!handler)
          continue;

        const toolResult = await handler(invocation, currentHistory);
        const responseFragment = create_FunctionCallResponse_ContentFragment(
          invocation.id,
          toolResult.error,
          invocation.invocation.name,
          toolResult.result,
          'client',
        );

        lastResult = {
          ...lastResult,
          finalMessage: {
            ...lastResult.finalMessage,
            fragments: [
              ...structuredClone(lastResult.finalMessage.fragments),
              responseFragment,
            ],
          },
        };

        if (assistantMessageId)
          params.session.messageFragmentAppend(assistantMessageId, responseFragment, false, false);

        params.runOptions?.onStreamUpdate?.(lastResult.finalMessage, false);
        onLoopStreamUpdate?.(lastResult.finalMessage, false);
      }

      currentHistory = [
        ...baseHistory,
        assistantMessageId
          ? duplicateDMessage(params.session.historyFindMessageOrThrow(assistantMessageId) ?? buildAssistantHistoryMessage({
            participant: params.participant,
            assistantLlmId: params.assistantLlmId,
            message: lastResult.finalMessage,
            messageChannel: params.messageChannel,
          }), false)
          : buildAssistantHistoryMessage({
            participant: params.participant,
            assistantLlmId: params.assistantLlmId,
            message: lastResult.finalMessage,
            messageChannel: params.messageChannel,
          }),
      ];
      firstPass = false;
    }

    return lastResult ?? await executePersona({
      ...params,
      keepAbortController: true,
      sharedAbortController: loopAbortController,
      runOptions: {
        ...params.runOptions,
        requestTransform: baseRequestTransform,
      },
    });
  } finally {
    if (managesAbortController)
      params.session.clearAbortController('chat-persona-tool-loop');
  }
}
