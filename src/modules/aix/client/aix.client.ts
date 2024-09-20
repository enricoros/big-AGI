import { findServiceAccessOrThrow } from '~/modules/llms/vendors/vendor.helpers';

import { DLLMId, LLM_IF_SPECIAL_OAI_O1Preview } from '~/common/stores/llms/llms.types';
import type { DMessage, DMessageGenerator } from '~/common/stores/chat/chat.message';
import { apiStream } from '~/common/util/trpc.client';
import { chatGenerateMetricsLgToMd, computeChatGenerationCosts, DChatGenerateMetricsLg } from '~/common/stores/metrics/metrics.chatgenerate';
import { createErrorContentFragment, DMessageContentFragment } from '~/common/stores/chat/chat.fragments';
import { findLLMOrThrow } from '~/common/stores/llms/store-llms';
import { getLabsDevMode, getLabsDevNoStreaming } from '~/common/state/store-ux-labs';
import { metricsStoreAddChatGenerate } from '~/common/stores/metrics/store-metrics';
import { presentErrorToHumans } from '~/common/util/errorUtils';

// NOTE: pay particular attention to the "import type", as this is importing from the server-side Zod definitions
import type { AixAPI_Access, AixAPI_Context, AixAPI_Context_ChatGenerateNS, AixAPI_Context_ChatGenerateStream, AixAPI_Model, AixAPIChatGenerate_Request } from '../server/api/aix.wiretypes';

import { ContentReassembler } from './ContentReassembler';
import { ThrottleFunctionCall } from './ThrottleFunctionCall';
import { aixChatGenerateRequestFromDMessages, clientHotFixGenerateRequestForO1Preview } from './aix.client.chatGenerateRequest';


// configuration
export const DEBUG_PARTICLES = false;


export function aixCreateChatGenerateNSContext(name: AixAPI_Context_ChatGenerateNS['name'], ref: string): AixAPI_Context_ChatGenerateNS {
  return { method: 'chat-generate', name, ref };
}

export function aixCreateChatGenerateStreamContext(name: AixAPI_Context_ChatGenerateStream['name'], ref: string): AixAPI_Context_ChatGenerateStream {
  return { method: 'chat-stream', name, ref };
}

export function aixCreateModelFromLLMOptions(llmOptions: Record<string, any>, debugLlmId: string): AixAPI_Model {
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


export interface AixChatGenerateDMessageUpdate extends Pick<DMessage, 'fragments' | 'generator' | 'pendingIncomplete'> {
  // overwriting in DMessage
  fragments: DMessageContentFragment[];
  generator: DMessageGenerator;
  pendingIncomplete: boolean;
}

type StreamMessageStatus = {
  outcome: 'success' | 'aborted' | 'errored',
  errorMessage?: string
};


export async function aixChatGenerateContentStreaming(
  // chat-inputs -> Partial<DMessage> outputs
  llmId: DLLMId,
  chatHistory: Readonly<DMessage[]>,
  // aix inputs
  aixContextName: AixAPI_Context_ChatGenerateStream['name'],
  aixContextRef: AixAPI_Context['ref'],
  // others
  throttleParallelThreads: number, // 0: disable, 1: default throttle (12Hz), 2+ reduce frequency with the square root
  abortSignal: AbortSignal,
  onStreamingUpdate: (update: AixChatGenerateDMessageUpdate, isDone: boolean) => void,
): Promise<StreamMessageStatus> {

  const returnStatus: StreamMessageStatus = { outcome: 'success', errorMessage: undefined };

  const aixChatContentGenerateRequest = await aixChatGenerateRequestFromDMessages(chatHistory, 'complete');

  const throttler = new ThrottleFunctionCall(throttleParallelThreads);

  const chatDMessageUpdate: AixChatGenerateDMessageUpdate = {
    fragments: [],
    generator: { mgt: 'named', name: llmId as any },
    pendingIncomplete: true,
  };

  try {

    await aixLLMChatGenerateContent(llmId, aixChatContentGenerateRequest, aixCreateChatGenerateStreamContext(aixContextName, aixContextRef), true, abortSignal,
      ({ fragments, generator }: AixLLMGenerateContentAccumulator, isDone: boolean) => {

        // typesafe overwrite on all fields (Object.assign, but typesafe)
        chatDMessageUpdate.fragments = fragments;
        chatDMessageUpdate.generator = generator;
        chatDMessageUpdate.pendingIncomplete = !isDone;

        // throttle the update - and skip the last done message
        if (!isDone)
          throttler.decimate(() => onStreamingUpdate(chatDMessageUpdate, false));
      },
    );

  } catch (error: any) {
    // this can only be a large, user-visible error, such as LLM not found
    console.error('[DEV] aixChatGenerateContentStreaming error:', error);
    chatDMessageUpdate.fragments.push(
      createErrorContentFragment(`Issue: ${error.message || (typeof error === 'string' ? error : 'Chat stopped.')}`),
    );
    chatDMessageUpdate.generator.tokenStopReason = 'issue';
    returnStatus.outcome = 'errored';
    returnStatus.errorMessage = error.message;
  }

  // Ensure the last content is flushed out, and mark as complete
  chatDMessageUpdate.pendingIncomplete = false;
  throttler.finalize(() => onStreamingUpdate(chatDMessageUpdate, true));

  // TODO: check something beyond this return status (as exceptions almost never happen here)
  // - e.g. the generator.aix may have error/token stop codes

  return returnStatus;
}


/**
 * Accumulator for ChatGenerate output data, as it is being streamed.
 * The object is modified in-place and passed to the callback for efficiency.
 */
export interface AixLLMGenerateContentAccumulator extends Pick<DMessage, 'fragments' | 'generator'> {
  // overwriting in DMessage
  fragments: DMessageContentFragment[];
  generator: Extract<DMessageGenerator, { mgt: 'aix' }>;
}

/**
 * Generation from an LLM Id,
 *
 * @throws Error if the LLM is not found or other misconfigurations, but handles most other errors internally.
 */
export async function aixLLMChatGenerateContent<TServiceSettings extends object = {}, TAccess extends AixAPI_Access = AixAPI_Access>(
  // llm Id input -> access & model
  llmId: DLLMId,
  // aix inputs
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContext: AixAPI_Context,
  aixStreaming: boolean,
  // others
  abortSignal: AbortSignal,
  onStreamingUpdate?: (llmAccumulator: AixLLMGenerateContentAccumulator, isDone: boolean) => void,
): Promise<AixLLMGenerateContentAccumulator> {

  // Aix Access
  const llm = findLLMOrThrow(llmId);
  const { transportAccess: aixAccess, serviceSettings, vendor } = findServiceAccessOrThrow<TServiceSettings, TAccess>(llm.sId);

  // [OpenAI] Apply the hot fix for O1 Preview models; however this is a late-stage emergency hotfix as we expect the caller to be aware of this logic
  const isO1Preview = llm.interfaces.includes(LLM_IF_SPECIAL_OAI_O1Preview);
  if (isO1Preview) {
    clientHotFixGenerateRequestForO1Preview(aixChatGenerate);
    aixStreaming = false;
  }

  // [OpenAI-only] check for harmful content with the free 'moderation' API, if the user requests so
  // if (aixAccess.dialect === 'openai' && aixAccess.moderationCheck) {
  //   const moderationUpdate = await _openAIModerationCheck(aixAccess, messages.at(-1) ?? null);
  //   if (moderationUpdate)
  //     return onUpdate({ textSoFar: moderationUpdate, typing: false }, true);
  // }

  // Aix Low-Level Chat Generation
  const dMessage: AixLLMGenerateContentAccumulator = {
    fragments: [],
    generator: {
      mgt: 'aix',
      name: llmId,
      aix: {
        vId: llm.vId,
        mId: llm.id, // NOTE: using llm.id instead of aixModel.id (the ref) so we can re-select them in the UI (Beam)
      },
    },
  };

  // streaming initial notification, to record
  onStreamingUpdate?.(dMessage, false);

  // apply any vendor-specific rate limit
  await vendor.rateLimitChatGenerate?.(llm, serviceSettings);

  // Aix Model
  const aixModel = aixCreateModelFromLLMOptions(llm.options, llmId);

  // Aix Low-Level Chat Generation
  await _aix_LL_ChatGenerateContent(aixAccess, aixModel, aixChatGenerate, aixContext, aixStreaming, abortSignal,
    (ll: Aix_LL_ChatGenerateContent_Accumulator, isDone: boolean) => {

      // copy the right information at the right place in the tree
      if (ll.fragments.length) dMessage.fragments = ll.fragments;
      // Note: we are willingly reducing the size of the object here, as it's ready for DMessage storage
      if (ll.genMetricsLg) dMessage.generator.metrics = chatGenerateMetricsLgToMd(ll.genMetricsLg);
      if (ll.genModelName) dMessage.generator.name = ll.genModelName;
      if (ll.genTokenStopReason) dMessage.generator.tokenStopReason = ll.genTokenStopReason;

      // if this is the last message, proceed with the finalization
      if (isDone) {
        // compute costs
        const costs = computeChatGenerationCosts(dMessage.generator.metrics, llm.pricing?.chat);
        if (costs && dMessage.generator.metrics)
          Object.assign(dMessage.generator.metrics, costs);

        // notify the store that tracks costs
        if (costs) {
          const m = dMessage.generator.metrics;
          metricsStoreAddChatGenerate(costs, llm, (m?.TIn || 0) + (m?.TCacheRead || 0) + (m?.TCacheWrite || 0), (m?.TOut || 0));
        }
      }

      // streaming update
      onStreamingUpdate?.(dMessage, isDone);
    },
  );

  return dMessage;
}


/**
 * Accumulator for Lower Level ChatGenerate output data, as it is being streamed.
 * The object is modified in-place and passed to the callback for efficiency.
 */
export interface Aix_LL_ChatGenerateContent_Accumulator {
  // source of truth for any caller
  // - empty array means no content yet, and no error
  fragments: DMessageContentFragment[];

  // pieces of generator
  genMetricsLg?: DChatGenerateMetricsLg;
  genModelName?: string;
  genTokenStopReason?: DMessageGenerator['tokenStopReason'];
}

/**
 * Low-level client-side ChatGenerateContent, with optional streaming.
 *
 * Contract:
 * - empty fragments means no content yet, and no error
 * - aixStreaming hints the source, but can be respected or not
 *   - onReassemblyUpdate is optional, you can ignore the updates and await the final result
 * - errors become Error fragments, and they can be dialect-sent, dispatch-excepts, client-read issues or even user aborts
 * - empty fragments:
 *   - in the interim updates, means no content yet
 *   - in the final update, means there was no content received at all
 * - the output (accumulaor) is always a complete object with all fragments
 *   - of the reasons, 'client-abort' and 'out-of-tokens' are the only ones that can be set without any fragments
 *
 * Inputs are all Aix_* objects:
 *
 * @param aixAccess abstracts the provider-specific configuration
 * @param aixModel selects and provides the model-specific configuration
 * @param aixChatGenerate the chat generation request specifics, which includes system instructions and various tools use:
 *    - tools include Function Declaration (for function calling) Gemini Code Execution, etc.
 *    - special parts include 'In Reference To' (a decorator of messages)
 *    - other special parts include the Anthropic Caching hints, on select message
 * @param aixContext specifies the scope of the caller, such as what's the high level objective of this call
 * @param aixStreaming requests the source to provide incremental updates
 * @param abortSignal allows the caller to stop the operation
 *
 * The output is an accumulator object with the fragments, and the generator
 * pieces (metrics, model name, token stop reason)
 *
 * @param onReassemblyUpdate updated with the same accumulator at every step, and at the end (with isDone=true)
 * @returns the final accumulator object
 *
 */
async function _aix_LL_ChatGenerateContent(
  // aix inputs
  aixAccess: AixAPI_Access,
  aixModel: AixAPI_Model,
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContext: AixAPI_Context,
  aixStreaming: boolean,
  // others
  abortSignal: AbortSignal,
  // optional streaming callback
  onReassemblyUpdate?: (llAccumulator: Aix_LL_ChatGenerateContent_Accumulator, isDone: boolean) => void,
): Promise<Aix_LL_ChatGenerateContent_Accumulator> {

  // Aix Low-Level Chat Generation Accumulator
  const llAccumulator: Aix_LL_ChatGenerateContent_Accumulator = {
    fragments: [],
    /* rest start as undefined (missing in reality) */
  };
  const contentReassembler = new ContentReassembler(llAccumulator);

  try {

    // tRPC Aix Chat Generation (streaming) API - inside the try block for deployment path errors
    const particles = await apiStream.aix.chatGenerateContent.mutate({
      access: aixAccess,
      model: aixModel,
      chatGenerate: aixChatGenerate,
      context: aixContext,
      streaming: getLabsDevNoStreaming() ? false : aixStreaming, // [DEV] disable streaming if set in the UX (testing)
      connectionOptions: getLabsDevMode() ? { debugDispatchRequestbody: true } : undefined,
    }, {
      signal: abortSignal,
    });

    // reassemble the particles
    for await (const particle of particles) {
      contentReassembler.reassembleParticle(particle);
      onReassemblyUpdate?.(llAccumulator, false);
    }

  } catch (error: any) {

    // something else broke, likely a User Abort, or an Aix server error (e.g. tRPC)
    const isUserAbort = abortSignal.aborted;
    const isErrorAbort = (error instanceof Error) && (error.name === 'AbortError' || (error.cause instanceof DOMException && error.cause.name === 'AbortError'));
    if (isUserAbort || isErrorAbort) {
      if (isUserAbort !== isErrorAbort)
        if (process.env.NODE_ENV === 'development')
          console.error(`[DEV] Aix streaming AbortError mismatch (${isUserAbort}, ${isErrorAbort})`, { error: error });
      contentReassembler.reassembleClientAbort();
    } else {
      if (process.env.NODE_ENV === 'development')
        console.error('[DEV] Aix streaming Error:', error);
      const showAsBold = !!llAccumulator.fragments.length;
      contentReassembler.reassembleClientException(presentErrorToHumans(error, showAsBold, true) || 'Unknown error');
    }

  }

  // and we're done
  contentReassembler.reassembleFinalize();

  // streaming update
  onReassemblyUpdate?.(llAccumulator, true /* Last message, done */);

  // return the final accumulated message
  return llAccumulator;
}
