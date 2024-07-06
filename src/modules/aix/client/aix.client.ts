import type { ChatStreamingInputSchema } from '~/modules/llms/server/llm.server.streaming';
import type { DLLMId } from '~/modules/llms/store-llms';
import { findVendorForLlmOrThrow } from '~/modules/llms/vendors/vendors.registry';

import { apiStream } from '~/common/util/trpc.client';

import type { VChatContextRef, VChatFunctionIn, VChatMessageIn, VChatStreamContextName } from '~/modules/llms/llm.client';

import type { AixAccess, AixHistory, AixModel, AixStreamGenerateContext } from '../shared/aix.shared.types';
import type { AixToolPolicy, AixTools } from '../shared/aix.shared.tools';


export type StreamingClientUpdate = Partial<{
  textSoFar: string;
  typing: boolean;
  originLLM: string;
}>;


export async function aixStreamingChatGenerate<TSourceSetup = unknown, TAccess extends ChatStreamingInputSchema['access'] = ChatStreamingInputSchema['access']>(
  llmId: DLLMId,
  history: VChatMessageIn[],
  contextName: VChatStreamContextName,
  contextRef: VChatContextRef,
  functions: VChatFunctionIn[] | null,
  forceFunctionName: string | null,
  abortSignal: AbortSignal,
  onUpdate: (update: StreamingClientUpdate, done: boolean) => void,
): Promise<void> {

  // id to DLLM and vendor
  const { llm, vendor } = findVendorForLlmOrThrow<TSourceSetup, TAccess>(llmId);

  // FIXME: relax the forced cast
  const llmOptions = llm.options;

  // get the access
  const partialSourceSetup = llm._source.setup;
  const access = vendor.getTransportAccess(partialSourceSetup); // as ChatStreamInputSchema['access'];

  // get any vendor-specific rate limit delay
  const delay = vendor.getRateLimitDelay?.(llm, partialSourceSetup) ?? 0;
  if (delay > 0)
    await new Promise(resolve => setTimeout(resolve, delay));

  // [OpenAI-only] check for harmful content with the free 'moderation' API, if the user requests so
  // if (access.dialect === 'openai' && access.moderationCheck) {
  //   const moderationUpdate = await _openAIModerationCheck(access, messages.at(-1) ?? null);
  //   if (moderationUpdate)
  //     return onUpdate({ textSoFar: moderationUpdate, typing: false }, true);
  // }


  // execute via the vendor
  return await aixStreamGenerateUnified(
    access,
    aixModelFromLLMOptions(llm.options, llmId),
    history,
    undefined,
    undefined,
    aixStreamGenerateContext(contextName, contextRef),
    abortSignal,
    onUpdate,
  );
  // return await vendor.streamingChatGenerateOrThrow(access, llmId, llmOptions, messages, contextName, contextRef, functions, forceFunctionName, abortSignal, onUpdate);
}


function aixModelFromLLMOptions(llmOptions: Record<string, any>, debugLlmId: string): AixModel {
  // model params (llm)
  const { llmRef, llmTemperature, llmResponseTokens } = llmOptions || {};
  if (!llmRef || llmTemperature === undefined)
    throw new Error(`Error in configuration for model ${debugLlmId}: ${JSON.stringify(llmOptions)}`);

  return {
    id: llmRef,
    temperature: llmTemperature,
    ...(llmResponseTokens ? { maxTokens: llmResponseTokens } : {}),
  };
}

function aixStreamGenerateContext(contextName: VChatStreamContextName, contextRef: VChatContextRef): AixStreamGenerateContext {
  return {
    method: 'chat-stream',
    name: contextName,
    ref: contextRef,
  };
}


/**
 * Client side chat generation, with streaming. This decodes the (text) streaming response from
 * our server streaming endpoint (plain text, not EventSource), and signals updates via a callback.
 *
 * Vendor-specific implementation is on our server backend (API) code. This function tries to be
 * as generic as possible.
 *
 * NOTE: onUpdate is callback when a piece of a message (text, model name, typing..) is received
 */
export async function aixStreamGenerateUnified<TSourceSetup = unknown>(
  // input
  access: AixAccess,
  model: AixModel,
  history: AixHistory,
  tools: AixTools | undefined,
  toolPolicy: AixToolPolicy | undefined,
  context: AixStreamGenerateContext,
  // others
  abortSignal: AbortSignal,
  onUpdate: (update: StreamingClientUpdate, done: boolean) => void,
): Promise<void> {

  const x = await apiStream.aix.chatGenerateContentStream.mutate({
    access,
    model,
    history,
    tools,
    toolPolicy,
    context,
  }, { signal: abortSignal });

  let incrementalText = '';

  try {
    for await (const update of x) {
      console.log('cs update:', update);

      if ('t' in update) {
        incrementalText += update.t;
        onUpdate({ textSoFar: incrementalText, typing: true }, false);
      } else if ('set' in update) {
        if (update.set.model)
          onUpdate({ originLLM: update.set.model }, false);
        else
          console.log('set:', update.set);
      } else if ('issueId' in update) {
        incrementalText += update.issueText;
        onUpdate({ textSoFar: incrementalText, typing: true }, false);
      } else
        console.log('update:', update);
    }
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || (error.cause instanceof DOMException && error.cause.name === 'AbortError'))) {
      console.log('client-side aborted 111111111111111111111111111222222');
    } else {
      console.error('Client catch:', (error as any).name, { error });
    }
  }

  console.log('HERE', abortSignal.aborted ? 'client-initiated ABORTED' : '');

  onUpdate({ typing: false }, true);

}
