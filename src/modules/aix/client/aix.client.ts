import type { ChatStreamingInputSchema } from '~/modules/llms/server/llm.server.streaming';
import type { DLLMId } from '~/modules/llms/store-llms';
import { findVendorForLlmOrThrow } from '~/modules/llms/vendors/vendors.registry';

import { apiStream } from '~/common/util/trpc.client';

import type { Intake_Access, Intake_ContextChatStream, Intake_Model } from '../server/intake/schemas.intake.api';

import type { AixChatContentGenerateRequest } from './aix.client.api';


export type StreamingClientUpdate = Partial<{
  textSoFar: string;
  typing: boolean;
  originLLM: string;
}>;


export async function aixStreamingChatGenerate<TSourceSetup = unknown, TAccess extends ChatStreamingInputSchema['access'] = ChatStreamingInputSchema['access']>(
  llmId: DLLMId,
  chatGenerate: AixChatContentGenerateRequest,
  intakeContextName: Intake_ContextChatStream['name'],
  intakeContextRef: string,
  abortSignal: AbortSignal,
  onUpdate: (update: StreamingClientUpdate, done: boolean) => void,
): Promise<void> {

  // id to DLLM and vendor
  const { llm, vendor } = findVendorForLlmOrThrow<TSourceSetup, TAccess>(llmId);

  // FIXME: relax the forced cast
  // const llmOptions = llm.options;
  const intakeModel = intakeModelFromLLMOptions(llm.options, llmId);

  // get the access
  const partialSourceSetup = llm._source.setup;
  const intakeAccess = vendor.getTransportAccess(partialSourceSetup);

  // get any vendor-specific rate limit delay
  const delay = vendor.getRateLimitDelay?.(llm, partialSourceSetup) ?? 0;
  if (delay > 0)
    await new Promise(resolve => setTimeout(resolve, delay));

  // [OpenAI-only] check for harmful content with the free 'moderation' API, if the user requests so
  // if (intakeAccess.dialect === 'openai' && intakeAccess.moderationCheck) {
  //   const moderationUpdate = await _openAIModerationCheck(intakeAccess, messages.at(-1) ?? null);
  //   if (moderationUpdate)
  //     return onUpdate({ textSoFar: moderationUpdate, typing: false }, true);
  // }


  // execute via the vendor
  // return await vendor.streamingChatGenerateOrThrow(intakeAccess, llmId, llmOptions, messages, contextName, contextRef, functions, forceFunctionName, abortSignal, onUpdate);
  const intakeContext = intakeContextChatStream(intakeContextName, intakeContextRef);
  return await _aixStreamGenerateUnified(intakeAccess, intakeModel, chatGenerate, intakeContext, abortSignal, onUpdate);
}

function intakeContextChatStream(name: Intake_ContextChatStream['name'], ref: string): Intake_ContextChatStream {
  return { method: 'chat-stream', name, ref };
}

function intakeModelFromLLMOptions(llmOptions: Record<string, any>, debugLlmId: string): Intake_Model {
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


/**
 * Client side chat generation, with streaming. This decodes the (text) streaming response from
 * our server streaming endpoint (plain text, not EventSource), and signals updates via a callback.
 *
 * Vendor-specific implementation is on our server backend (API) code. This function tries to be
 * as generic as possible.
 *
 * NOTE: onUpdate is callback when a piece of a message (text, model name, typing..) is received
 */
async function _aixStreamGenerateUnified(
  // input
  access: Intake_Access,
  model: Intake_Model,
  chatGenerate: AixChatContentGenerateRequest,
  context: Intake_ContextChatStream,
  // others
  abortSignal: AbortSignal,
  onUpdate: (update: StreamingClientUpdate, done: boolean) => void,
): Promise<void> {

  const operation = await apiStream.aix.chatGenerateContent.mutate(
    { access, model, chatGenerate, context, streaming: true, _debugRequestBody: false },
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
