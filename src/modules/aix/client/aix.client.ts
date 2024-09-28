import { findServiceAccessOrThrow } from '~/modules/llms/vendors/vendor.helpers';

import { DLLM, DLLMId, LLM_IF_SPECIAL_OAI_O1Preview } from '~/common/stores/llms/llms.types';
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

export function aixCreateModelFromLLMOptions(
  llmOptions: Record<string, any> | undefined,
  llmOptionsOverride: Record<string, any> | undefined,
  debugLlmId: string
): AixAPI_Model {
  // model params (llm)
  let { llmRef, llmTemperature, llmResponseTokens } = llmOptions || {};
  if (!llmRef || llmTemperature === undefined)
    throw new Error(`AIX: Error in configuration for model ${debugLlmId} (missing ref, temperature): ${JSON.stringify(llmOptions)}`);

  // model params overrides
  if (llmOptionsOverride?.llmTemperature !== undefined) llmTemperature = llmOptionsOverride.llmTemperature;
  if (llmOptionsOverride?.llmResponseTokens !== undefined) llmResponseTokens = llmOptionsOverride.llmResponseTokens;

  return {
    id: llmRef,
    temperature: llmTemperature,
    ...(llmResponseTokens ? { maxTokens: llmResponseTokens } : {}),
  };
}


/**
 * Accumulator for ChatGenerate output data, as it is being streamed.
 * The object is modified in-place from the lower layers and passed to the callback for efficiency.
 */
export interface AixChatGenerateContent_DMessage extends Pick<DMessage, 'fragments' | 'generator' | 'pendingIncomplete'> {
  fragments: DMessageContentFragment[];
  generator: DMessageGenerator; // Extract<DMessageGenerator, { mgt: 'aix' }>;
  pendingIncomplete: boolean;
}

type StreamMessageStatus = {
  outcome: 'success' | 'aborted' | 'errored',
  lastDMessage: AixChatGenerateContent_DMessage,
  errorMessage?: string
};


interface AixClientOptions {
  abortSignal: AbortSignal,
  throttleParallelThreads?: number; // 0: disable, 1: default throttle (12Hz), 2+ reduce frequency with the square root
  llmOptionsOverride?: Partial<{
    llmTemperature: number,
    llmResponseTokens: number,
  }>;
}


/**
 * Level 3 Generation from an LLM Id + Chat History.
 */
export async function aixChatGenerateContent_DMessage_FromHistory(
  // chat-inputs -> Partial<DMessage> outputs
  llmId: DLLMId,
  chatHistory: Readonly<DMessage[]>,
  // aix inputs
  aixContextName: AixAPI_Context_ChatGenerateStream['name'],
  aixContextRef: AixAPI_Context['ref'],
  // others
  clientOptions: AixClientOptions,
  onStreamingUpdate: (update: AixChatGenerateContent_DMessage, isDone: boolean) => void,
): Promise<StreamMessageStatus> {

  let errorMessage: string | undefined;

  let lastDMessage: AixChatGenerateContent_DMessage = {
    fragments: [],
    generator: {
      mgt: 'named',
      name: llmId as any,
    },
    pendingIncomplete: true,
  };

  try {

    // Aix ChatGenerate Request
    const aixChatContentGenerateRequest = await aixChatGenerateRequestFromDMessages(chatHistory, 'complete');

    await aixChatGenerateContent_DMessage(
      llmId,
      aixChatContentGenerateRequest,
      aixCreateChatGenerateStreamContext(aixContextName, aixContextRef),
      true,
      clientOptions,
      (update: AixChatGenerateContent_DMessage, isDone: boolean) => {
        lastDMessage = update;
        onStreamingUpdate(lastDMessage, isDone);
      },
    );

  } catch (error: any) {

    // this can only be a large, user-visible error, such as LLM not found
    console.warn('[DEV] aixChatGenerateContentStreaming error:', { error });

    errorMessage = error.message || (typeof error === 'string' ? error : 'Chat stopped.');
    lastDMessage.fragments.push(createErrorContentFragment(`Issue: ${errorMessage}`));
    lastDMessage.generator = {
      ...lastDMessage.generator,
      tokenStopReason: 'issue',
    };
    lastDMessage.pendingIncomplete = false;
  }

  // TODO: check something beyond this return status (as exceptions almost never happen here)
  // - e.g. the generator.aix may have error/token stop codes

  return {
    outcome: errorMessage ? 'errored' : lastDMessage.generator?.tokenStopReason === 'client-abort' ? 'aborted' : 'success',
    lastDMessage: lastDMessage,
    errorMessage: errorMessage || undefined,
  };
}


/**
 * Generates chat content using a specified LLM and ChatGenerateRequest (incl. Tools) and returns a DMessage-compatible object.
 *
 * Contract:
 * - empty fragments means no content yet, and no error
 * - pendingIncomplete is true until the final update & final object (or unless this throws)
 * - errors become Error fragments, and they can be dialect-sent, dispatch-excepts, client-read issues or even user aborts
 * @throws Error if the LLM is not found or other misconfigurations, but handles most other errors internally.
 *
 * Features:
 * - Throttling if requrested (decimates the requests based on the square root of the number parllel hints)
 * - computes the costs and metrics for the chat generation
 * - vendor-specific rate limit
 * - 'pendingIncomplete' logic
 * - 'o1-preview' hotfix for OpenAI models
 * - [NOT PORTED YET: checks for harmful content with the free 'moderation' API (OpenAI-only)]
 *
 * @param llmId - ID of the Language Model to use
 * @param aixChatGenerate - Multi-modal chat generation request specifics, including Tools and high-level metadata
 * @param aixContext - Information about how this chat generation is being used
 * @param aixStreaming - Whether to use streaming for generation
 * @param clientOptions - Client options for the operation
 * @param onStreamingUpdate - Optional callback for streaming updates
 *
 * @returns Promise<AixChatGenerateContent_DMessage> - The final DMessage-compatible object
 */
export async function aixChatGenerateContent_DMessage<TServiceSettings extends object = {}, TAccess extends AixAPI_Access = AixAPI_Access>(
  // llm Id input -> access & model
  llmId: DLLMId,
  // aix inputs
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContext: AixAPI_Context,
  aixStreaming: boolean,
  // others
  clientOptions: AixClientOptions,
  onStreamingUpdate?: (update: AixChatGenerateContent_DMessage, isDone: boolean) => void,
): Promise<AixChatGenerateContent_DMessage> {

  // Aix Access
  const llm = findLLMOrThrow(llmId);
  const { transportAccess: aixAccess, serviceSettings, vendor } = findServiceAccessOrThrow<TServiceSettings, TAccess>(llm.sId);

  // Aix Model
  const aixModel = aixCreateModelFromLLMOptions(llm.options, clientOptions?.llmOptionsOverride, llmId);

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
  const dMessage: AixChatGenerateContent_DMessage = {
    fragments: [],
    generator: {
      mgt: 'aix',
      name: llmId,
      aix: {
        vId: llm.vId,
        mId: llm.id, // NOTE: using llm.id instead of aixModel.id (the ref) so we can re-select them in the UI (Beam)
      },
      // metrics: undefined,
      // tokenStopReason: undefined,
    },
    pendingIncomplete: true,
  };

  // streaming initial notification, for UI updates
  onStreamingUpdate?.(dMessage, false);

  // apply any vendor-specific rate limit
  await vendor.rateLimitChatGenerate?.(llm, serviceSettings);

  // decimator for the updates
  const throttler = (onStreamingUpdate && clientOptions.throttleParallelThreads) ? new ThrottleFunctionCall(clientOptions.throttleParallelThreads) : null;

  // Aix Low-Level Chat Generation
  const llAccumulator = await _aixChatGenerateContent_LL(aixAccess, aixModel, aixChatGenerate, aixContext, aixStreaming, clientOptions.abortSignal,
    (ll: AixChatGenerateContent_LL, isDone: boolean) => {
      if (isDone) return;
      _llToDMessage(ll, dMessage);
      if (onStreamingUpdate) {
        if (throttler)
          throttler.decimate(() => onStreamingUpdate(dMessage, false));
        else
          onStreamingUpdate(dMessage, false);
      }
    },
  );

  // Mark as complete
  dMessage.pendingIncomplete = false;

  // LLM Cost computation & Aggregations
  _llToDMessage(llAccumulator, dMessage);
  _updateDMessageCosts(dMessage, llm);

  // final update (could ignore and take the dMessage)
  onStreamingUpdate?.(dMessage, true);

  return dMessage;
}

function _llToDMessage(src: AixChatGenerateContent_LL, dest: AixChatGenerateContent_DMessage) {
  if (src.fragments.length)
    dest.fragments = src.fragments; // Note: this gets replaced once, and then it's the same from that point on
  if (src.genMetricsLg)
    dest.generator.metrics = chatGenerateMetricsLgToMd(src.genMetricsLg); // reduce the size to store in DMessage
  if (src.genModelName)
    dest.generator.name = src.genModelName;
  if (src.genTokenStopReason)
    dest.generator.tokenStopReason = src.genTokenStopReason;
}

function _updateDMessageCosts(dest: AixChatGenerateContent_DMessage, llm: DLLM) {
  // Compute costs
  const costs = computeChatGenerationCosts(dest.generator.metrics, llm.pricing?.chat);
  if (!costs) {
    // FIXME: we shall warn that the costs are missing, as the only way to get pricing is through surfacing missing prices
    return;
  }

  // Add the costs to the generator.metrics object
  if (dest.generator.metrics)
    Object.assign(dest.generator.metrics, costs);

  // Run aggregations
  const m = dest.generator.metrics;
  const inputTokens = (m?.TIn || 0) + (m?.TCacheRead || 0) + (m?.TCacheWrite || 0);
  const outputTokens = (m?.TOut || 0) + (m?.TOutR || 0);
  metricsStoreAddChatGenerate(costs, inputTokens, outputTokens, llm);
}


/**
 * Accumulator for Lower Level ChatGenerate output data, as it is being streamed.
 * The object is modified in-place and passed to the callback for efficiency.
 */
export interface AixChatGenerateContent_LL {
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
 * - the output (accumulator) is always a complete object with all fragments
 *   - of the reasons, 'client-abort' and 'out-of-tokens' are the only ones that can be set without any fragments
 *
 * Inputs are all Aix_* objects:
 *
 * @param aixAccess abstracts the provider-specific configuration
 * @param aixModel selects and provides the model-specific configuration
 * @param aixChatGenerate the chat generation request specifics, which includes system instructions and various tools use:
 *    - tools include Function Declaration (for function calling), Gemini Code Execution, etc.
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
async function _aixChatGenerateContent_LL(
  // aix inputs
  aixAccess: AixAPI_Access,
  aixModel: AixAPI_Model,
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContext: AixAPI_Context,
  aixStreaming: boolean,
  // others
  abortSignal: AbortSignal,
  // optional streaming callback
  onReassemblyUpdate?: (accumulator: AixChatGenerateContent_LL, isDone: boolean) => void,
): Promise<AixChatGenerateContent_LL> {

  // Aix Low-Level Chat Generation Accumulator
  const accumulator_LL: AixChatGenerateContent_LL = {
    fragments: [],
    /* rest start as undefined (missing in reality) */
  };
  const contentReassembler = new ContentReassembler(accumulator_LL);

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
      contentReassembler.reassembleParticle(particle, abortSignal.aborted);
      onReassemblyUpdate?.(accumulator_LL, false);
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
      const showAsBold = !!accumulator_LL.fragments.length;
      contentReassembler.reassembleClientException('Application error: ' + presentErrorToHumans(error, showAsBold, true) || 'Unknown error');
    }

  }

  // and we're done
  contentReassembler.reassembleFinalize();

  // final update (could ignore and take the final accumulator)
  onReassemblyUpdate?.(accumulator_LL, true /* Last message, done */);

  // return the final accumulated message
  return accumulator_LL;
}
