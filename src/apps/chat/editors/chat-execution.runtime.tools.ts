import * as z from 'zod/v4';

import type { ChatExecutionRuntimeRunPersonaParams, ChatExecutionSession } from './chat-execution.runtime';
import type { PersonaRunResult, PersonaRunOptions } from './chat-persona';
import { applyMessageChannelScope } from './chat-persona';

import { aixFunctionCallTool } from '~/modules/aix/client/aix.client.fromSimpleFunction';
import type { AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { createDMessageEmpty, createDMessageTextContent, duplicateDMessage, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import type { DMessageContentFragment, DMessageFragment, DMessageToolInvocationPart } from '~/common/stores/chat/chat.fragments';
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
  allowSubagentDelegation?: boolean;
};

type ToolHandlerResult = {
  error: boolean | string;
  result: string;
};

type FunctionToolInvocation = DMessageToolInvocationPart & {
  invocation: Extract<DMessageToolInvocationPart['invocation'], { type: 'function_call' }>;
};

type ToolHandler = (
  invocation: FunctionToolInvocation,
  sourceHistory: Readonly<DMessage[]>,
  parentMessageId: string | null,
) => Promise<ToolHandlerResult>;

type PersonaExecutor = (params: ChatExecutionRuntimeRunPersonaParams) => Promise<PersonaRunResult>;

type SubagentProgressStatus = 'queued' | 'running' | 'streaming' | 'finalizing' | 'done' | 'failed';

function composeRequestTransforms(
  baseTransform: PersonaRunOptions['requestTransform'] | undefined,
  nextTransform: NonNullable<PersonaRunOptions['requestTransform']>,
): PersonaRunOptions['requestTransform'] {
  return request => nextTransform(baseTransform ? baseTransform(request) : request);
}

function composeRequestTransformsReverse(
  baseTransform: PersonaRunOptions['requestTransform'] | undefined,
  nextTransform: NonNullable<PersonaRunOptions['requestTransform']>,
): PersonaRunOptions['requestTransform'] {
  return request => baseTransform ? baseTransform(nextTransform(request)) : nextTransform(request);
}

function createSubagentRequestTransform(): NonNullable<PersonaRunOptions['requestTransform']> {
  return request => {
    if ((request as AixAPIChatGenerate_Request & { __disallowSubagentDelegation?: boolean }).__disallowSubagentDelegation)
      return request;

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
  const latestInvocationById = new Map<string, FunctionToolInvocation>();
  const latestResponseById = new Set<string>();
  const pendingInvocations: FunctionToolInvocation[] = [];

  for (const fragment of contentFragments) {
    if (isToolInvocationPart(fragment.part) && fragment.part.invocation.type === 'function_call') {
      if (executableToolNames.has(fragment.part.invocation.name))
        latestInvocationById.set(fragment.part.id, fragment.part as FunctionToolInvocation);
      continue;
    }
    if (isToolResponseFunctionCallPart(fragment.part))
      latestResponseById.add(fragment.part.id);
  }

  for (const [invocationId, invocation] of latestInvocationById.entries())
    if (!latestResponseById.has(invocationId))
      pendingInvocations.push(invocation);

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

function buildToolFollowUpHistory(params: {
  baseHistory: Readonly<DMessage[]>;
  assistantMessage: DMessage;
}): DMessage[] {
  const history = params.baseHistory.map(message => duplicateDMessage(message, false));
  const toolFollowUpMessage = createDMessageEmpty('user');
  toolFollowUpMessage.fragments = cloneMessageFragments(params.assistantMessage.fragments).map(fragment =>
    fragment.ft === 'content' && fragment.part.pt === 'text'
      ? {
          ...fragment,
          part: {
            ...fragment.part,
            text: fragment.part.text.trimEnd(),
          },
        }
      : fragment,
  );
  toolFollowUpMessage.updated = toolFollowUpMessage.created;
  history.push(toolFollowUpMessage);
  return history;
}

function cloneMessageFragments<TFragment extends DMessageFragment>(fragments: readonly TFragment[] | null | undefined): TFragment[] {
  return structuredClone((fragments ?? []) as TFragment[]) as TFragment[];
}

function mergeFinalMessages(prefix: PersonaRunResult['finalMessage'], suffix: PersonaRunResult['finalMessage']): PersonaRunResult['finalMessage'] {
  return {
    fragments: [
      ...cloneMessageFragments(prefix.fragments),
      ...cloneMessageFragments(suffix.fragments),
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
    fragments: cloneMessageFragments(message.fragments),
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
    'After using any delegated tools, you must still send a final visible assistant reply that summarizes the result for your parent agent.',
    'Do not stop after a tool result or internal progress update.',
  ].join('\n'));
}

function formatSubagentProgressText(params: {
  prompt: string;
  status: SubagentProgressStatus;
  visibleText?: string | null;
  note?: string | null;
}): string {
  const statusLabel = params.status === 'queued'
    ? 'Queued'
    : params.status === 'running'
      ? 'Running delegated task'
      : params.status === 'streaming'
        ? 'Streaming visible output'
        : params.status === 'finalizing'
          ? 'Finalizing result'
          : params.status === 'done'
            ? 'Complete'
            : 'Failed';

  const sections = [
    `**Task**\n${params.prompt.trim()}`,
    `**Status**\n${statusLabel}`,
  ];

  if (params.note?.trim())
    sections.push(`**Activity**\n${params.note.trim()}`);

  if (params.visibleText?.trim())
    sections.push(`**Current output**\n${params.visibleText.trim()}`);
  else if (params.status !== 'done' && params.status !== 'failed')
    sections.push('**Current output**\nWaiting for first visible output...');

  return sections.join('\n\n');
}

function createSubagentToolHandlers(
  params: ChatExecutionRuntimeRunPersonaParams,
  executePersona: PersonaExecutor,
  context: ToolLoopContext,
  abortController: AbortController,
): Map<string, ToolHandler> {
  return new Map<string, ToolHandler>([
    [SUBAGENT_TOOL_NAME, async (invocation, sourceHistory, parentMessageId) => {
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
        formatSubagentProgressText({
          prompt: parsedArgs.prompt,
          status: 'queued',
          note: 'Creating delegated run context.',
        }),
      );
      ephemeral.updateState({
        depth: context.depth + 1,
        prompt: parsedArgs.prompt,
        status: 'running',
        phase: 'Creating delegated run context',
        messageFragments: [],
        parentMessageId,
        parentToolInvocationId: invocation.id,
      });
      if (ephemeral.replaceWithExisting?.(invocation.id, ephemeral.getState?.() ?? {}))
        return {
          error: false,
          result: JSON.stringify({
            ok: true,
            message: '',
          }),
        };

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
          allowSubagentDelegation: false,
        }, (message, messageComplete) => {
          const visibleText = messageFragmentsReduceText(message.fragments ?? []).trim();
          const progressStatus: SubagentProgressStatus = messageComplete
            ? 'finalizing'
            : visibleText
              ? 'streaming'
              : 'running';
          ephemeral.updateText(formatSubagentProgressText({
            prompt: parsedArgs.prompt,
            status: progressStatus,
            visibleText,
            note: messageComplete
              ? 'Wrapping up delegated result.'
              : visibleText
                ? 'Received visible output from delegated run.'
                : 'Waiting for delegated visible output.',
          }));
          ephemeral.updateState({
            depth: context.depth + 1,
            prompt: parsedArgs.prompt,
            status: messageComplete ? 'finalizing' : visibleText ? 'streaming' : 'running',
            phase: messageComplete
              ? 'Wrapping up delegated result'
              : visibleText
                ? 'Streaming visible output'
                : 'Waiting for delegated visible output',
            messageFragments: cloneMessageFragments(message.fragments),
            parentMessageId,
            parentToolInvocationId: invocation.id,
          });
        });

        const childMessage = messageFragmentsReduceText(childResult.finalMessage.fragments ?? []).trim();
        const toolPayload = childMessage
          ? {
              ok: true,
              message: childMessage,
            }
          : {
              ok: childResult.success,
              message: '',
            };

        ephemeral.updateText(formatSubagentProgressText({
          prompt: parsedArgs.prompt,
          status: childResult.success ? 'done' : 'failed',
          visibleText: childMessage,
          note: childMessage ? 'Delegated run returned a final result.' : 'Delegated run completed without visible text.',
        }));
        ephemeral.updateState({
          depth: context.depth + 1,
          prompt: parsedArgs.prompt,
          status: childResult.success ? 'done' : 'failed',
          phase: childResult.success ? 'Delegated run completed' : 'Delegated run failed',
          messageFragments: cloneMessageFragments(childResult.finalMessage.fragments),
          parentMessageId,
          parentToolInvocationId: invocation.id,
        });

        return {
          error: childResult.success ? false : 'subagent execution failed',
          result: JSON.stringify(toolPayload),
        };
      } catch (error) {
        ephemeral.updateText(formatSubagentProgressText({
          prompt: parsedArgs.prompt,
          status: 'failed',
          visibleText: error instanceof Error && error.message ? error.message : 'Subagent execution failed.',
          note: 'Delegated run failed before returning a final result.',
        }));
        ephemeral.updateState({
          depth: context.depth + 1,
          prompt: parsedArgs.prompt,
          status: 'failed',
          phase: 'Delegated run failed',
          messageFragments: [],
          parentMessageId,
          parentToolInvocationId: invocation.id,
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
  const baseRequestTransform: PersonaRunOptions['requestTransform'] = request => {
    const requestWithDelegationFlag = {
      ...request,
      __disallowSubagentDelegation: context.allowSubagentDelegation === false,
    } as AixAPIChatGenerate_Request & { __disallowSubagentDelegation?: boolean };
    return composeRequestTransforms(
      params.runOptions?.requestTransform,
      createSubagentRequestTransform(),
    )?.(requestWithDelegationFlag) ?? requestWithDelegationFlag;
  };

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
      if (!lastResult)
        throw new Error('tool loop invariant: missing last result');

      const pendingInvocations = getPendingClientToolInvocations(lastResult.finalMessage.fragments, executableToolNames);
      const terminalIssueDetected = !!assistantMessageId && lastResult.finalMessage.fragments.some(fragment =>
        fragment.ft === 'content'
        && fragment.part.pt === 'error',
      );
      if (terminalIssueDetected)
        return lastResult;
      if (!pendingInvocations.length || loopAbortController.signal.aborted)
        return lastResult;
      let accumulatedResult: PersonaRunResult = lastResult;

      const resolvedToolResults = await Promise.all(pendingInvocations.map(async invocation => {
        const handler = toolHandlers.get(invocation.invocation.name);
        if (!handler)
          return null;

        const toolResult = await handler(invocation, currentHistory, assistantMessageId);
        return create_FunctionCallResponse_ContentFragment(
          invocation.id,
          toolResult.error,
          invocation.invocation.name,
          toolResult.result,
          'client',
        );
      }));

      for (const responseFragment of resolvedToolResults) {
        if (!responseFragment)
          continue;

        accumulatedResult = {
          ...accumulatedResult,
          finalMessage: {
            ...accumulatedResult.finalMessage,
            fragments: [
              ...cloneMessageFragments(accumulatedResult.finalMessage.fragments),
              responseFragment,
            ],
          },
        };
        lastResult = accumulatedResult;

        if (assistantMessageId)
          params.session.messageFragmentAppend(assistantMessageId, responseFragment, false, false);

        params.runOptions?.onStreamUpdate?.(accumulatedResult.finalMessage, false);
        onLoopStreamUpdate?.(accumulatedResult.finalMessage, false);
      }

      const assistantHistoryMessage = assistantMessageId
        ? duplicateDMessage(params.session.historyFindMessageOrThrow(assistantMessageId) ?? buildAssistantHistoryMessage({
          participant: params.participant,
          assistantLlmId: params.assistantLlmId,
          message: accumulatedResult.finalMessage,
          messageChannel: params.messageChannel,
        }), false)
        : buildAssistantHistoryMessage({
          participant: params.participant,
          assistantLlmId: params.assistantLlmId,
          message: accumulatedResult.finalMessage,
          messageChannel: params.messageChannel,
        });
      currentHistory = buildToolFollowUpHistory({
        baseHistory,
        assistantMessage: assistantHistoryMessage,
      });
      firstPass = false;
    }

    return lastResult ?? await executePersona({
      ...params,
      keepAbortController: true,
      sharedAbortController: loopAbortController,
      sourceHistory: currentHistory,
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
