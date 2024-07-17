import type { ChatStreamingInputSchema } from '~/modules/llms/server/llm.server.streaming';
import type { DLLMId } from '~/modules/llms/store-llms';
import { findVendorForLlmOrThrow } from '~/modules/llms/vendors/vendors.registry';

import { apiStream } from '~/common/util/trpc.client';
import { getLabsDevMode } from '~/common/state/store-ux-labs';

// NOTE: pay particular attention to the "import type", as this is importing from the server-side Zod definitions
import type { AixAPI_Access, AixAPI_ContextChatStream, AixAPI_Model, AixAPIChatGenerate_Request } from '~/modules/aix/server/aix.wiretypes';


export type StreamingClientUpdate = Partial<{
  textSoFar: string;
  typing: boolean;
  originLLM: string;
}>;


export async function aixStreamingChatGenerate<TSourceSetup = unknown, TAccess extends ChatStreamingInputSchema['access'] = ChatStreamingInputSchema['access']>(
  llmId: DLLMId,
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContextName: AixAPI_ContextChatStream['name'],
  aixContextRef: AixAPI_ContextChatStream['ref'],
  abortSignal: AbortSignal,
  onUpdate: (update: StreamingClientUpdate, done: boolean) => void,
): Promise<void> {

  // Aix Access
  const { llm, vendor } = findVendorForLlmOrThrow<TSourceSetup, TAccess>(llmId);
  const partialSourceSetup = llm._source.setup;
  const aixAccess = vendor.getTransportAccess(partialSourceSetup);

  // Aix Model - FIXME: relax the forced cast
  // const llmOptions = llm.options;
  const aixModel = _aixModelFromLLMOptions(llm.options, llmId);

  // Aix Context
  const aixContext = { method: 'chat-stream', name: aixContextName, ref: aixContextRef } as const;

  // Simple rate limiting (vendor-specific)
  const delay = vendor.getRateLimitDelay?.(llm, partialSourceSetup) ?? 0;
  if (delay > 0)
    await new Promise(resolve => setTimeout(resolve, delay));

  // [OpenAI-only] check for harmful content with the free 'moderation' API, if the user requests so
  // if (aixAccess.dialect === 'openai' && aixAccess.moderationCheck) {
  //   const moderationUpdate = await _openAIModerationCheck(aixAccess, messages.at(-1) ?? null);
  //   if (moderationUpdate)
  //     return onUpdate({ textSoFar: moderationUpdate, typing: false }, true);
  // }

  // execute via the vendor
  // return await vendor.streamingChatGenerateOrThrow(aixAccess, llmId, llmOptions, messages, contextName, contextRef, functions, forceFunctionName, abortSignal, onUpdate);
  return await _aixChatGenerateContent(aixAccess, aixModel, aixChatGenerate, aixContext, abortSignal, onUpdate);
}


function _aixModelFromLLMOptions(llmOptions: Record<string, any>, debugLlmId: string): AixAPI_Model {
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


export let devMode_AixLastDispatchRequestBody: string | null = null;


/**
 * Client side chat generation, with streaming. This decodes the (text) streaming response from
 * our server streaming endpoint (plain text, not EventSource), and signals updates via a callback.
 *
 * Vendor-specific implementation is on our server backend (API) code. This function tries to be
 * as generic as possible.
 *
 * NOTE: onUpdate is callback when a piece of a message (text, model name, typing..) is received
 */
async function _aixChatGenerateContent(
  // aix inputs
  aixAccess: AixAPI_Access,
  aixModel: AixAPI_Model,
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContext: AixAPI_ContextChatStream,
  // others
  abortSignal: AbortSignal,
  onUpdate: (update: StreamingClientUpdate, done: boolean) => void,
): Promise<void> {

  const operation = await apiStream.aix.chatGenerateContent.mutate(
    { access: aixAccess, model: aixModel, chatGenerate: aixChatGenerate, context: aixContext, streaming: true, _debugRequestBody: getLabsDevMode() },
    { signal: abortSignal },
  );

  let incrementalText = '';

  try {
    for await (const update of operation) {
      // TODO: improve this recombination protocol...
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
      } else if ('_debugClientPrint' in update) {
        console.log('_debugClientPrint:', update._debugClientPrint);
        devMode_AixLastDispatchRequestBody = update._debugClientPrint;
      } else
        console.log('update:', update);
    }
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || (error.cause instanceof DOMException && error.cause.name === 'AbortError'))) {
      console.log('client-side aborted 111111111111111111111111111222222');
    } else {
      console.error('aix stream gen Client catch:', (error as any).name, { error });
    }
  }

  console.log('HERE', abortSignal.aborted ? 'client-initiated ABORTED' : '');

  onUpdate({ typing: false }, true);
}
