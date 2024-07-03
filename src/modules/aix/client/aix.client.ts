import type { ChatStreamingInputSchema } from '~/modules/llms/server/llm.server.streaming';
import { DLLMId } from '~/modules/llms/store-llms';
import { findVendorForLlmOrThrow } from '~/modules/llms/vendors/vendors.registry';
import { VChatContextRef, VChatFunctionIn, VChatMessageIn, VChatStreamContextName } from '~/modules/llms/llm.client';


import { frontendSideFetch } from '~/common/util/clientFetchers';
import { AixGenerateContentInput } from '~/modules/aix/shared/aix.shared.chat';
import { AixAccess, AixHistory, AixModel, AixStreamGenerateContext } from '~/modules/aix/shared/aix.shared.types';
import { AixToolPolicy, AixTools } from '~/modules/aix/shared/aix.shared.tools';


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
  return await aixStreamGenerateDirect(
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
export async function aixStreamGenerateDirect<TSourceSetup = unknown>(
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

  // assemble the input object
  const aixGenerateContentInput: AixGenerateContentInput = {
    access,
    model,
    history,
    // tools: undefined,
    // toolPolicy: undefined,
    context,
  };

  // connect to the server-side streaming endpoint
  const timeFetch = performance.now();
  const streamResponse = await frontendSideFetch('/api/llms/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(aixGenerateContentInput),
    signal: abortSignal,
  });

  // connection error to our backend
  if (!streamResponse.ok || !streamResponse.body) {
    const errorMessage = streamResponse.body ? await streamResponse.text().catch(() => 'No content from server') : 'No response from server';
    onUpdate({ textSoFar: errorMessage, typing: false }, true);
    return;
  }

  const responseReader = streamResponse.body.getReader();

  let incrementalText = '';
  let parsedPreambleStart = false;
  let parsedPreableModel = false;

  // loop forever until the read is done, or the abort controller is triggered
  const textDecoder = new TextDecoder('utf-8');
  while (true) {

    // read until done - can THROW (e.g. when the stream is aborted)
    const { value, done } = await responseReader.read().catch((test) => {
      // Error reading stream (e.g. aborted by the user, network disconnect/timeout, etc.)
      // we just rethrow the error for now
      throw test;
    });
    if (done) {
      if (value?.length)
        console.log('aixStreamGenerateDirect: unexpected value in the last packet:', value?.length);
      break;
    }

    incrementalText += textDecoder.decode(value, { stream: true });

    // we have two packets with a serialized flat json object at the start; this is side data, before the text flow starts
    // while ((!parsedPreambleStart || !parsedPreableModel) && incrementalText.startsWith('{')) {
    //
    //   // extract a complete JSON object, if present
    //   const endOfJson = incrementalText.indexOf('}');
    //   if (endOfJson === -1) break;
    //   const jsonString = incrementalText.substring(0, endOfJson + 1);
    //   incrementalText = incrementalText.substring(endOfJson + 1);
    //
    //   // first packet: preamble to let the Vercel edge function go over time
    //   if (!parsedPreambleStart) {
    //     parsedPreambleStart = true;
    //     try {
    //       const parsed: ChatStreamingPreambleStartSchema = JSON.parse(jsonString);
    //       if (parsed.type !== 'start')
    //         console.log('unifiedStreamingClient: unexpected preamble type:', parsed?.type, 'time:', performance.now() - timeFetch);
    //     } catch (e) {
    //       // error parsing JSON, ignore
    //       console.log('unifiedStreamingClient: error parsing start JSON:', e);
    //     }
    //     continue;
    //   }
    //
    //   // second packet: the model name
    //   if (!parsedPreableModel) {
    //     parsedPreableModel = true;
    //     try {
    //       const parsed: ChatStreamingPreambleModelSchema = JSON.parse(jsonString);
    //       onUpdate({ originLLM: parsed.model }, false);
    //     } catch (e) {
    //       // error parsing JSON, ignore
    //       console.log('unifiedStreamingClient: error parsing model JSON:', e);
    //     }
    //   }
    // }

    if (incrementalText)
      onUpdate({ textSoFar: incrementalText }, false);
  }
}
