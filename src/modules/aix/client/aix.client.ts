import { findServiceAccessOrThrow } from '~/modules/llms/vendors/vendor.helpers';

import type { MaybePromise } from '~/common/types/useful.types';
import { DLLM, DLLMId, getLLMPricing, LLM_IF_HOTFIX_NoTemperature, LLM_IF_OAI_Responses, LLM_IF_Outputs_Audio, LLM_IF_Outputs_Image, LLM_IF_Outputs_NoText } from '~/common/stores/llms/llms.types';
import { DMessage, DMessageGenerator, messageSetGeneratorAIX_AutoLabel } from '~/common/stores/chat/chat.message';
import { DMetricsChatGenerate_Lg, metricsChatGenerateLgToMd, metricsComputeChatGenerateCostsMd } from '~/common/stores/metrics/metrics.chatgenerate';
import { DModelParameterValues, getAllModelParameterValues } from '~/common/stores/llms/llms.parameters';
import { apiStream } from '~/common/util/trpc.client';
import { createErrorContentFragment, DMessageContentFragment, DMessageErrorPart, DMessageVoidFragment, isContentFragment, isErrorPart } from '~/common/stores/chat/chat.fragments';
import { findLLMOrThrow } from '~/common/stores/llms/store-llms';
import { getAixInspectorEnabled } from '~/common/stores/store-ui';
import { getLabsDevNoStreaming } from '~/common/stores/store-ux-labs';
import { metricsStoreAddChatGenerate } from '~/common/stores/metrics/store-metrics';
import { webGeolocationCached } from '~/common/util/webGeolocationUtils';

// NOTE: pay particular attention to the "import type", as this is importing from the server-side Zod definitions
import type { AixAPI_Access, AixAPI_ConnectionOptions_ChatGenerate, AixAPI_Context_ChatGenerate, AixAPI_Model, AixAPIChatGenerate_Request, AixWire_Particles } from '../server/api/aix.wiretypes';

import { AixStreamRetry } from './aix.client.retry';
import { ContentReassembler } from './ContentReassembler';
import { aixCGR_ChatSequence_FromDMessagesOrThrow, aixCGR_FromSimpleText, aixCGR_SystemMessage_FromDMessageOrThrow, AixChatGenerate_TextMessages, clientHotFixGenerateRequest_ApplyAll } from './aix.client.chatGenerateRequest';
import { aixClassifyStreamingError } from './aix.client.errors';
import { withDecimator } from './withDecimator';


// configuration
export const DEBUG_PARTICLES = false;


export function aixCreateChatGenerateContext(name: AixAPI_Context_ChatGenerate['name'], ref: string | '_DEV_'): AixAPI_Context_ChatGenerate {
  return { method: 'chat-generate', name, ref };
}

export function aixCreateModelFromLLMOptions(
  llmInterfaces: DLLM['interfaces'],
  llmOptions: DModelParameterValues, // this must have been already externally computed, usually as the initial values + user/over replacements
  llmOptionOverrides: Omit<DModelParameterValues, 'llmRef'> | undefined,
  debugLlmId: string,
): AixAPI_Model {

  // make sure llmRef is removed, if present in the override - excess of caution here
  if (llmOptionOverrides) {
    llmOptionOverrides = { ...llmOptionOverrides };
    delete (llmOptionOverrides as { llmRef?: any }).llmRef;
  }

  // destructure input with the overrides
  const {
    llmRef, llmTemperature, llmResponseTokens, llmTopP,
    llmVndAnt1MContext, llmVndAntSkills, llmVndAntThinkingBudget, llmVndAntWebFetch, llmVndAntWebSearch, llmVndAntEffort,
    llmVndGeminiAspectRatio, llmVndGeminiImageSize, llmVndGeminiCodeExecution, llmVndGeminiComputerUse, llmVndGeminiGoogleSearch, llmVndGeminiMediaResolution, llmVndGeminiShowThoughts, llmVndGeminiThinkingBudget, llmVndGeminiThinkingLevel,
    // llmVndMoonshotWebSearch,
    llmVndOaiReasoningEffort, llmVndOaiReasoningEffort4, llmVndOaiReasoningEffort52, llmVndOaiReasoningEffort52Pro, llmVndOaiRestoreMarkdown, llmVndOaiVerbosity, llmVndOaiWebSearchContext, llmVndOaiWebSearchGeolocation, llmVndOaiImageGeneration,
    llmVndOrtWebSearch,
    llmVndPerplexityDateFilter, llmVndPerplexitySearchMode,
    llmVndXaiSearchMode, llmVndXaiSearchSources, llmVndXaiSearchDateFilter,
  } = {
    ...llmOptions,
    ...llmOptionOverrides,
  };

  // llmRef is absolutely required
  if (!llmRef)
    throw new Error(`AIX: Error in configuration for model ${debugLlmId} (missing ref, temperature): ${JSON.stringify(llmOptions)}`);

  // llmTemperature is highly recommended, so we display a note if it's missing
  if (llmTemperature === undefined)
    console.warn(`[DEV] AIX: Missing temperature for model ${debugLlmId}, using default.`);

  // Output modalities
  const acceptsOutputs: AixAPI_Model['acceptsOutputs'] = [];
  if (!llmInterfaces.includes(LLM_IF_Outputs_NoText)) acceptsOutputs.push('text');
  if (llmInterfaces.includes(LLM_IF_Outputs_Audio)) acceptsOutputs.push('audio');
  if (llmInterfaces.includes(LLM_IF_Outputs_Image)) acceptsOutputs.push('image');

  // Output APIs
  const llmVndOaiResponsesAPI = llmInterfaces.includes(LLM_IF_OAI_Responses);

  // Client-side late stage model HotFixes
  const hotfixOmitTemperature = llmInterfaces.includes(LLM_IF_HOTFIX_NoTemperature);

  // User Geolocation
  let userGeolocation: AixAPI_Model['userGeolocation'] | undefined;
  if (llmVndOaiWebSearchGeolocation) {
    const webGeolocation = webGeolocationCached();
    if (webGeolocation) {
      userGeolocation = {
        ...(webGeolocation.city ? { city: webGeolocation.city } : {}),
        ...(webGeolocation.country ? { country: webGeolocation.country } : {}),
        ...(webGeolocation.region ? { region: webGeolocation.region } : {}),
        timezone: webGeolocation.timezone,
      };
    } else
      console.log(`[DEV] AIX: Geolocation is requested for model ${debugLlmId}, but it's not available.`);
  }

  return {
    id: llmRef,
    acceptsOutputs: acceptsOutputs,
    ...(hotfixOmitTemperature ? { temperature: null } : llmTemperature !== undefined ? { temperature: llmTemperature } : {}),
    ...(llmResponseTokens /* null: similar to undefined, will omit the value */ ? { maxTokens: llmResponseTokens } : {}),
    ...(llmTopP !== undefined ? { topP: llmTopP } : {}),
    ...(llmVndAntThinkingBudget !== undefined ? { vndAntThinkingBudget: llmVndAntThinkingBudget } : {}),
    ...(llmVndAnt1MContext ? { vndAnt1MContext: llmVndAnt1MContext } : {}),
    ...(llmVndAntSkills ? { vndAntSkills: llmVndAntSkills } : {}),
    ...(llmVndAntWebFetch === 'auto' ? { vndAntWebFetch: llmVndAntWebFetch } : {}),
    ...(llmVndAntWebSearch === 'auto' ? { vndAntWebSearch: llmVndAntWebSearch } : {}),
    ...(llmVndAntEffort ? { vndAntEffort: llmVndAntEffort } : {}),
    ...(llmVndGeminiAspectRatio ? { vndGeminiAspectRatio: llmVndGeminiAspectRatio } : {}),
    ...(llmVndGeminiCodeExecution === 'auto' ? { vndGeminiCodeExecution: llmVndGeminiCodeExecution } : {}),
    ...(llmVndGeminiComputerUse ? { vndGeminiComputerUse: llmVndGeminiComputerUse } : {}),
    ...(llmVndGeminiGoogleSearch ? {
      vndGeminiGoogleSearch: llmVndGeminiGoogleSearch,
      vndGeminiUrlContext: 'auto', // NOTE: we are now driving both from the client side, search and fetch, without a dedicated setting, for UX simplicity
    } : {}),
    ...(llmVndGeminiImageSize ? { vndGeminiImageSize: llmVndGeminiImageSize } : {}),
    ...(llmVndGeminiMediaResolution ? { vndGeminiMediaResolution: llmVndGeminiMediaResolution } : {}),
    ...(llmVndGeminiShowThoughts ? { vndGeminiShowThoughts: llmVndGeminiShowThoughts } : {}),
    ...(llmVndGeminiThinkingBudget !== undefined ? { vndGeminiThinkingBudget: llmVndGeminiThinkingBudget } : {}),
    ...(llmVndGeminiThinkingLevel ? { vndGeminiThinkingLevel: llmVndGeminiThinkingLevel } : {}),
    // ...(llmVndGeminiUrlContext === 'auto' ? { vndGeminiUrlContext: llmVndGeminiUrlContext } : {}),
    // ...(llmVndMoonshotWebSearch === 'auto' ? { vndMoonshotWebSearch: 'auto' } : {}),
    ...(llmVndOaiResponsesAPI ? { vndOaiResponsesAPI: true } : {}),
    ...((llmVndOaiReasoningEffort52Pro || llmVndOaiReasoningEffort52 || llmVndOaiReasoningEffort4 || llmVndOaiReasoningEffort) ? { vndOaiReasoningEffort: llmVndOaiReasoningEffort52Pro || llmVndOaiReasoningEffort52 || llmVndOaiReasoningEffort4 || llmVndOaiReasoningEffort } : {}),
    ...(llmVndOaiRestoreMarkdown ? { vndOaiRestoreMarkdown: llmVndOaiRestoreMarkdown } : {}),
    ...(llmVndOaiVerbosity ? { vndOaiVerbosity: llmVndOaiVerbosity } : {}),
    ...(llmVndOaiWebSearchContext ? { vndOaiWebSearchContext: llmVndOaiWebSearchContext } : {}),
    ...(llmVndOaiImageGeneration ? { vndOaiImageGeneration: (llmVndOaiImageGeneration as any /* backward comp */) === true ? 'mq' : llmVndOaiImageGeneration } : {}),
    ...(llmVndOrtWebSearch === 'auto' ? { vndOrtWebSearch: 'auto' } : {}),
    ...(llmVndPerplexityDateFilter ? { vndPerplexityDateFilter: llmVndPerplexityDateFilter } : {}),
    ...(llmVndPerplexitySearchMode ? { vndPerplexitySearchMode: llmVndPerplexitySearchMode } : {}),
    ...(userGeolocation ? { userGeolocation } : {}),
    ...(llmVndXaiSearchMode ? { vndXaiSearchMode: llmVndXaiSearchMode } : {}),
    ...(llmVndXaiSearchSources ? { vndXaiSearchSources: llmVndXaiSearchSources } : {}),
    ...(llmVndXaiSearchDateFilter ? { vndXaiSearchDateFilter: llmVndXaiSearchDateFilter } : {}),
  };
}


/**
 * Accumulator for ChatGenerate output data, as it is being streamed.
 * The object is modified in-place from the lower layers and passed to the callback for efficiency.
 */
export interface AixChatGenerateContent_DMessageGuts extends Pick<DMessage, 'fragments' | 'generator' | 'pendingIncomplete'> {
  fragments: (DMessageContentFragment | DMessageVoidFragment /* no AttachmentFragments */)[];
  // Since 'aixChatGenerateContent_DMessage_FromConversation' starts from named (before replacement from LL), we can't Extract
  generator: DMessageGenerator; // Extract<DMessageGenerator, { mgt: 'aix' }>;
  pendingIncomplete: boolean;
}

type StreamMessageStatus = {
  outcome: 'success' | 'aborted' | 'errored',
  lastDMessage: AixChatGenerateContent_DMessageGuts,
  errorMessage?: string
};


interface AixClientOptions {
  abortSignal: AbortSignal | 'NON_ABORTABLE'; // 'NON_ABORTABLE' is a special case for non-abortable operations
  throttleParallelThreads?: number; // 0: disable, 1: default throttle (12Hz), 2+ reduce frequency with the square root

  // LLM parameter configuration layers: full replacement of user params and/or overrides of a set of individual params
  llmUserParametersReplacement?: DModelParameterValues; // can replace the 'global' llm user configuration with an alternate config (e.g. persona, or per-chat)
  llmOptionsOverride?: Omit<DModelParameterValues, 'llmRef'>; // overrides (sets/replaces) individual LLM parameters
}


/**
 * Level 3 Generation from an LLM Id + Chat History.
 */
export async function aixChatGenerateContent_DMessage_FromConversation(
  // chat-inputs -> Partial<DMessage> outputs
  llmId: DLLMId,
  chatSystemInstruction: null | Pick<DMessage, 'fragments' | 'metadata' | 'userFlags'>,
  chatHistoryWithoutSystemMessages: Readonly<DMessage[]>,
  // aix inputs
  aixContextName: AixAPI_Context_ChatGenerate['name'],
  aixContextRef: AixAPI_Context_ChatGenerate['ref'],
  // others
  clientOptions: AixClientOptions,
  onStreamingUpdate: (update: AixChatGenerateContent_DMessageGuts, isDone: boolean) => MaybePromise<void>,
): Promise<StreamMessageStatus> {

  let errorMessage: string | undefined;

  let lastDMessage: AixChatGenerateContent_DMessageGuts = {
    fragments: [],
    // NOTE: short-lived, immediately updated in the first callback. Note that we don't have the vendorId yet, otherwise we'd initialize this as 'aix' here
    generator: { mgt: 'named', name: llmId },
    pendingIncomplete: true,
  };

  try {

    // Aix ChatGenerate Request
    const aixChatContentGenerateRequest: AixAPIChatGenerate_Request = {
      systemMessage: await aixCGR_SystemMessage_FromDMessageOrThrow(chatSystemInstruction),
      chatSequence: await aixCGR_ChatSequence_FromDMessagesOrThrow(chatHistoryWithoutSystemMessages),
    };

    await aixChatGenerateContent_DMessage_orThrow(
      llmId,
      aixChatContentGenerateRequest,
      aixCreateChatGenerateContext(aixContextName, aixContextRef),
      true,
      clientOptions,
      async (update: AixChatGenerateContent_DMessageGuts, isDone: boolean) => {
        lastDMessage = update;
        await onStreamingUpdate(lastDMessage, isDone);
      },
    );

  } catch (error: any) {

    // this can only be a large, user-visible error, such as LLM not found
    console.warn('[DEV] aixChatGenerateContentStreaming error:', { error });

    // > error fragment
    errorMessage = error.message || (typeof error === 'string' ? error : 'Chat stopped.');
    lastDMessage.fragments.push(createErrorContentFragment(`Issue: ${errorMessage}`));

    // .generator: 'issue', no pendingIncomplete
    lastDMessage.generator = { ...lastDMessage.generator, tokenStopReason: 'issue' };
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
 * Accumulator for the simple text-only API
 */
interface AixChatGenerateText_Simple {
  text: string | null;
  generator: DMessageGenerator;
  isDone: boolean;
}

/**
 * Level 2 - Simpler facade to text-only inputs and text-only outputs - and nothing else. Old-school V1-like API.
 *
 * NOTE: this is a simplified version of the `aixChatGenerateContent_DMessage` function, with text-only inputs and outputs.
 * NOTE: it's missing throttling; there's the chance we could abstract and consolidate the two functions, because they are
 * NOTE: very similar in structure, just the inputs/outputs (and verifiers and transformations) are different.
 *
 * Contract - expects ONLY text/text in/out (e.g. no Tools, no upstream Error messages, no Empty messages):
 * - User aborts are thrown as AbortError
 * - Other issues are thrown as Error
 * - Aix issues (network, model, etc.) that became error fragments are re-thrown as Error
 *
 * @throws AbortError if the user aborts the operation
 * @throws Error if there are issues with the LLM Output, the Upstream AI service, the Aix API
 */
export async function aixChatGenerateText_Simple(
  // [V1-like text-only API] text inputs -> string output
  llmId: DLLMId,
  systemInstruction: null | string,
  aixTextMessages: AixChatGenerate_TextMessages | string, // if string, it's a single user message - maximum simplicity
  // aix inputs
  aixContextName: AixAPI_Context_ChatGenerate['name'],
  aixContextRef: AixAPI_Context_ChatGenerate['ref'],
  // optional options
  clientOptions?: Partial<AixClientOptions>, // this makes the abortController optional
  // optional callback for streaming
  onTextStreamUpdate?: (text: string, isDone: boolean, generator: DMessageGenerator) => MaybePromise<void>,
): Promise<string> {

  // Aix Access
  const llm = findLLMOrThrow(llmId);
  const { transportAccess: aixAccess, vendor: llmVendor, serviceSettings: llmServiceSettings } = findServiceAccessOrThrow<object, AixAPI_Access>(llm.sId);

  // Aix Model
  const llmParameters = getAllModelParameterValues(llm.initialParameters, clientOptions?.llmUserParametersReplacement ?? llm.userParameters);
  const aixModel = aixCreateModelFromLLMOptions(llm.interfaces, llmParameters, clientOptions?.llmOptionsOverride, llmId);

  // Aix ChatGenerate Request
  const aixChatGenerate = aixCGR_FromSimpleText(
    systemInstruction,
    typeof aixTextMessages === 'string' ? [{ role: 'user', text: aixTextMessages }] : aixTextMessages,
  );

  // Aix Context
  const aixContext = aixCreateChatGenerateContext(aixContextName, aixContextRef);

  // Aix Streaming - implicit if the callback is provided
  let aixStreaming = !!onTextStreamUpdate;


  // Client-side late stage model HotFixes
  const { shallDisableStreaming } = clientHotFixGenerateRequest_ApplyAll(llm.interfaces, aixChatGenerate, llmParameters.llmRef || llm.id);
  if (shallDisableStreaming || aixModel.forceNoStream)
    aixStreaming = false;


  // Variable to store the final text
  const state: AixChatGenerateText_Simple = {
    text: null,
    generator: { mgt: 'named', name: 'replace-me-ll' },
    isDone: false,
  };
  messageSetGeneratorAIX_AutoLabel(state, llm.vId, llm.id);

  // NO streaming initial notification - only notified past the first real characters
  // await onTextStreamUpdate?.(dText.text, false);

  // apply any vendor-specific rate limit
  await llmVendor.rateLimitChatGenerate?.(llm, llmServiceSettings);


  // Abort: if no signal is provided, we will create a dummy signal
  const abortSignal = (clientOptions?.abortSignal && clientOptions.abortSignal !== 'NON_ABORTABLE') ? clientOptions?.abortSignal
    : new AbortController().signal; // since this is a 'simple' low-stakes API, we can 'ignore' the abort signal and not enforce it with the caller


  // Aix Low-Level Chat Generation - does not throw, but may return an error in the final text
  const ll = await _aixChatGenerateContent_LL(
    aixAccess,
    aixModel,
    aixChatGenerate,
    aixContext,
    aixStreaming,
    abortSignal,
    clientOptions?.throttleParallelThreads ?? 0,
    !aixStreaming ? undefined : async (ll: AixChatGenerateContent_LL, _isDone: boolean /* we want to issue this, in case the next action is an exception */) => {
      _llToText(ll, state);
      if (onTextStreamUpdate && state.text !== null)
        await onTextStreamUpdate(state.text, false, state.generator);
    },
  );

  // Mark as complete
  state.isDone = true;

  // LLM Cost computation & Aggregations
  _llToText(ll, state);
  _updateGeneratorCostsInPlace(state.generator, llm, `aix_chatgenerate_text-${aixContextName}`);


  // re-throw the user-initiated abort, as the former function catches it
  if (abortSignal.aborted)
    throw new DOMException('Stopped.', 'AbortError');

  // throw if there was no text generated
  if (state.text === null)
    throw new Error('AIX: Empty text response.');

  // throw if there are error fragments
  const errorMessage = ll.fragments
    .filter(f => isContentFragment(f) && isErrorPart(f.part))
    .map(f => (f.part as DMessageErrorPart).error).join('\n');
  if (errorMessage)
    throw new Error('AIX: Error in response: ' + errorMessage);

  // final update
  await onTextStreamUpdate?.(state.text, true, state.generator);

  return state.text;
}

/**
 * Down-casts the LL to plain text, and updates the destination object.
 * - text -> text
 * - error -> inline error text: DO NOT THROW HERE, as the LL will catch it and add another error part with the same text
 * - tool -> throw: the LL will catch it and add the error text. However when done outside the LL (secondary usage) this will throw freely
 */
function _llToText(src: AixChatGenerateContent_LL, dest: AixChatGenerateText_Simple) {
  // copy over just the generator by using the accumulator -> DMessage-like copier
  _llToDMessageGuts(src, {
    generator: dest.generator, // target our dest's object
    fragments: [], pendingIncomplete: false, // unused, mocked
  });

  // transform the fragments to plain text
  if (src.fragments.length) {
    dest.text = '';
    for (let fragment of src.fragments) {
      const pt = fragment.part.pt;
      switch (pt) {
        case 'text':
          dest.text += fragment.part.text;
          break;
        case 'error':
          dest.text += (dest.text ? '\n' : '') + fragment.part.error;
          break;
        case 'tool_invocation':
          throw new Error(`AIX: Unexpected tool invocation ${fragment.part.invocation?.type === 'function_call' ? fragment.part.invocation.name : fragment.part.id} in the Text response.`);
        case 'annotations': // citations - ignored
        case 'ma': // model annotations (thinking tokens) - ignored
        case 'ph': // placeholder - ignored
        case 'reference': // impossible
        case 'image_ref': // impossible
        case 'tool_response': // impossible - stopped at the invocation already
        case '_pt_sentinel': // impossible
          break;
        default:
          const _exhaustiveCheck: never = pt;
      }
    }
  }
}


/**
 * Level 1 - Generates chat content using a specified LLM and ChatGenerateRequest (incl. Tools) and returns a DMessage-compatible object.
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
 * @returns Promise<AixChatGenerateContent_DMessageGuts> - The final DMessage-compatible object
 */
export async function aixChatGenerateContent_DMessage_orThrow<TServiceSettings extends object = {}, TAccess extends AixAPI_Access = AixAPI_Access>(
  // llm Id input -> access & model
  llmId: DLLMId,
  // aix inputs
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContext: AixAPI_Context_ChatGenerate,
  aixStreaming: boolean,
  // others
  clientOptions: AixClientOptions,
  onStreamingUpdate?: (update: AixChatGenerateContent_DMessageGuts, isDone: boolean) => MaybePromise<void>,
): Promise<AixChatGenerateContent_DMessageGuts> {

  // Aix Access
  const llm = findLLMOrThrow(llmId);
  const { transportAccess: aixAccess, vendor: llmVendor, serviceSettings: llmServiceSettings } = findServiceAccessOrThrow<TServiceSettings, TAccess>(llm.sId);

  // Aix Model
  const llmParameters = getAllModelParameterValues(llm.initialParameters, clientOptions?.llmUserParametersReplacement ?? llm.userParameters);
  const aixModel = aixCreateModelFromLLMOptions(llm.interfaces, llmParameters, clientOptions?.llmOptionsOverride, llmId);

  // Client-side late stage model HotFixes
  const { shallDisableStreaming } = clientHotFixGenerateRequest_ApplyAll(llm.interfaces, aixChatGenerate, llmParameters.llmRef || llm.id);
  if (shallDisableStreaming || aixModel.forceNoStream)
    aixStreaming = false;


  // [OpenAI-only] check for harmful content with the free 'moderation' API, if the user requests so
  // if (aixAccess.dialect === 'openai' && aixAccess.moderationCheck) {
  //   const moderationUpdate = await _openAIModerationCheck(aixAccess, messages.at(-1) ?? null);
  //   if (moderationUpdate)
  //     return onUpdate({ textSoFar: moderationUpdate, typing: false }, true);
  // }

  // Aix Low-Level Chat Generation
  const dMessage: AixChatGenerateContent_DMessageGuts = {
    fragments: [],
    generator: { mgt: 'named', name: 'replace-me-ll' /* metrics: undefined, tokenStopReason: undefined */ },
    pendingIncomplete: true,
  };
  // Note on the Generator. Besides the simple set below:
  // - it will get replaced once, and then it's the same from that point on
  // - using llm.id instead of aixModel.id (the ref) so we can re-select them in the UI (Beam)
  messageSetGeneratorAIX_AutoLabel(dMessage, llm.vId, llm.id);

  // streaming initial notification, for UI updates
  await onStreamingUpdate?.(dMessage, false);

  // apply any vendor-specific rate limit
  await llmVendor.rateLimitChatGenerate?.(llm, llmServiceSettings);

  // Abort: if the operation is non-abortable, we can't use the AbortSignal
  if (clientOptions.abortSignal === 'NON_ABORTABLE') {
    // [DEV] UGLY: here we have non-abortable operations -- we silence the warning, but something may be done in the future
    // console.log('[DEV] Aix non-abortable operation:', { aixContext, llmId });
    clientOptions.abortSignal = new AbortController().signal;
  }

  // Aix Low-Level Chat Generation
  const llAccumulator = await _aixChatGenerateContent_LL(aixAccess, aixModel, aixChatGenerate, aixContext, aixStreaming, clientOptions.abortSignal, clientOptions.throttleParallelThreads ?? 0,
    async (ll: AixChatGenerateContent_LL, isDone: boolean) => {
      if (isDone) return; // optimization, as there aren't branches between here and the final update below
      if (onStreamingUpdate) {
        _llToDMessageGuts(ll, dMessage);
        await onStreamingUpdate(dMessage, false);
      }
    },
  );

  // Mark as complete
  dMessage.pendingIncomplete = false;

  // LLM Cost computation & Aggregations
  _llToDMessageGuts(llAccumulator, dMessage);
  _updateGeneratorCostsInPlace(dMessage.generator, llm, `aix_chatgenerate_content-${aixContext.name}`);

  // final update (could ignore and take the dMessage)
  await onStreamingUpdate?.(dMessage, true);

  return dMessage;
}

function _llToDMessageGuts(src: AixChatGenerateContent_LL, dest: AixChatGenerateContent_DMessageGuts) {
  // replace the fragments if we have any
  if (src.fragments.length)
    dest.fragments = src.fragments; // Note: this gets replaced once, and then it's the same from that point on
  // replace the generator pieces
  if (src.genMetricsLg)
    dest.generator.metrics = metricsChatGenerateLgToMd(src.genMetricsLg); // reduce the size to store in DMessage
  if (src.genModelName)
    dest.generator.name = src.genModelName;
  if (src.genUpstreamHandle)
    dest.generator.upstreamHandle = src.genUpstreamHandle;
  if (src.genTokenStopReason)
    dest.generator.tokenStopReason = src.genTokenStopReason;
}

function _updateGeneratorCostsInPlace(generator: DMessageGenerator, llm: DLLM, debugCostSource: string) {
  // Compute costs
  const logLlmRefId = getAllModelParameterValues(llm.initialParameters, llm.userParameters).llmRef || llm.id;
  const costs = metricsComputeChatGenerateCostsMd(generator.metrics, getLLMPricing(llm)?.chat, logLlmRefId);
  if (!costs) {
    // FIXME: we shall warn that the costs are missing, as the only way to get pricing is through surfacing missing prices
    return;
  }

  // Add the costs to the generator.metrics object
  if (generator.metrics)
    Object.assign(generator.metrics, costs);

  // Run aggregations
  const m = generator.metrics;
  const inputTokens = (m?.TIn || 0) + (m?.TCacheRead || 0) + (m?.TCacheWrite || 0);
  const outputTokens = (m?.TOut || 0) /* + (m?.TOutR || 0) THIS IS A BREAKDOWN, IT'S ALREADY IN */;
  metricsStoreAddChatGenerate(costs, inputTokens, outputTokens, llm, debugCostSource);
}


/**
 * Accumulator for Lower Level ChatGenerate output data, as it is being streamed.
 * The object is modified in-place and passed to the callback for efficiency.
 */
export interface AixChatGenerateContent_LL {
  // source of truth for any caller
  // - empty array means no content yet, and no error
  fragments: (DMessageContentFragment | DMessageVoidFragment)[];

  // pieces of generator
  genMetricsLg?: DMetricsChatGenerate_Lg;
  genModelName?: string;
  genUpstreamHandle?: DMessageGenerator['upstreamHandle'];
  genTokenStopReason?: DMessageGenerator['tokenStopReason'];
}

/**
 * Low-level-0 client-side ChatGenerateContent, with optional streaming.
 *
 * Contract:
 * - empty fragments means no content yet, and no error
 * - aixStreaming hints the source, but can be respected or not
 *   - onReassemblyUpdate is optional, you can ignore the updates and await the final result
 * - errors become Error fragments, and they can be dialect-sent, dispatch-excepts, client-read issues or even user aborts
 *   - DOES NOT THROW, but the final accumulator may contain error fragments
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
 * @param throttleParallelThreads allows the caller to limit the number of parallel threads
 *
 * The output is an accumulator object with the fragments, and the generator
 * pieces (metrics, model name, token stop reason)
 *
 * @param onGenerateContentUpdate updated with the same accumulator at every step, and at the end (with isDone=true)
 * @returns the final accumulator object
 * @throws Error if there are rare low-level errors, or if [CSF] client-side fails to load
 *
 */
async function _aixChatGenerateContent_LL(
  // aix inputs
  aixAccess: AixAPI_Access,
  aixModel: AixAPI_Model,
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContext: AixAPI_Context_ChatGenerate,
  aixStreaming: boolean,
  // others
  abortSignal: AbortSignal,
  throttleParallelThreads: number | undefined,
  // optional streaming callback: not fired until the first piece of content
  onGenerateContentUpdate?: (accumulator: AixChatGenerateContent_LL, isDone: boolean) => MaybePromise<void>,
): Promise<AixChatGenerateContent_LL> {

  // Inspector support - can be requested by the client, but granted on the server side
  const inspectorEnabled = getAixInspectorEnabled();
  const inspectorContext = inspectorEnabled ? { contextName: aixContext.name, contextRef: aixContext.ref } : undefined;

  /**
   * FIXME: implement client selection of resumability - aixAccess option?
   * For now we turn it on for Responses API for select kinds of request.
   */
  const requestResumability = !!aixModel.vndOaiResponsesAPI &&
    (['conversation', 'beam-scatter', 'beam-gather'] satisfies (AixAPI_Context_ChatGenerate['name'] | string)[]).includes(aixContext.name);

  const aixConnectionOptions: AixAPI_ConnectionOptions_ChatGenerate = {
    ...inspectorEnabled && { debugDispatchRequest: true, debugProfilePerformance: true },
    // FIXME: disabled until clearly working
    // ...requestResumability && { enableResumability: true },
  } as const;


  // Aix Low-Level Chat Generation Accumulator
  const accumulator_LL: AixChatGenerateContent_LL = {
    fragments: [],
    /* rest start as undefined (missing in reality) */
  };


  // [CSF] Pre-load client-side executor if needed
  let clientSideChatGenerate: typeof import('./aix.client.direct-chatGenerate').clientSideChatGenerate | undefined = undefined;
  if (aixAccess.clientSideFetch)
    try {
      clientSideChatGenerate = (await import('./aix.client.direct-chatGenerate')).clientSideChatGenerate;
    } catch (error) {
      throw new Error(`Direct connection unsuccessful: ${(error as any)?.message || 'unknown loading error'}`, { cause: error });
    }


  // Retry/Reconnect - low-level state machine
  // - reconnect: for server overload/busy (429, 503, 502) and transient errors
  // - resume: for network disconnects with OpenAI Responses API handle
  const rsm = new AixStreamRetry(0, 0); // sensible: 3, 2

  while (true) {

    const sendContentUpdate = !onGenerateContentUpdate ? undefined : withDecimator(throttleParallelThreads ?? 0, 'aicChatGenerateContent', async () => {
      /**
       * We want the first update to have actual content.
       * However note that we won't be sending out the model name very fast this way,
       * but it's probably what we want because of the ParticleIndicators (VFX!)
       */
      if (!accumulator_LL.fragments.length)
        return;

      await onGenerateContentUpdate(accumulator_LL, false);
    });

    /**
     * Particles Reassembler.
     * - uses this accumulator
     * - calls a partial update callback with built-in decimation
     * - optional. forwards particles to the debugger
     * - abort will interrupt the fetch, and also the reassembly (for pieces coming still down the wire)
     */
    const reassembler = new ContentReassembler(
      accumulator_LL, // FIXME: TEMP: moved the accumulator outside to keep appending to it (recreating new ContentReassembler each retry)
      sendContentUpdate,
      inspectorContext,
      abortSignal,
    );

    try {

      let particleStream: AsyncIterable<AixWire_Particles.ChatGenerateOp, void>;

      // AIX [CSM] Direct Execution
      if (!rsm.resumeHandle && clientSideChatGenerate)
        particleStream = clientSideChatGenerate(
          aixAccess,
          aixModel,
          aixChatGenerate,
          getLabsDevNoStreaming() ? false : aixStreaming,
          abortSignal,
          !!aixConnectionOptions?.enableResumability,
        );

      // AIX tRPC Streaming Generation from Chat input
      else if (!rsm.resumeHandle)
        particleStream = await apiStream.aix.chatGenerateContent.mutate({
          access: aixAccess,
          model: aixModel,
          chatGenerate: aixChatGenerate,
          context: aixContext,
          streaming: getLabsDevNoStreaming() ? false : aixStreaming, // [DEV] disable streaming if set in the UX (testing)
          connectionOptions: aixConnectionOptions,
        }, { signal: abortSignal });

      // AIX tRPC Streaming re-attachment from handle - for low-level auto-resume
      else
        particleStream = await apiStream.aix.reattachContent.mutate({
          access: aixAccess,
          resumeHandle: rsm.resumeHandle,
          context: aixContext,
          streaming: true,
          connectionOptions: aixConnectionOptions,
        }, { signal: abortSignal });

      /**
       * Stream Consumption Loop - MUST be synchronous (no awaits).
       *
       * Critical: This loop only enqueues particles without awaiting processing.
       * If we await async work here, tRPC closes the connection while we're blocked,
       * causing "closed connection" exceptions when resuming. Processing happens in
       * ContentReassembler's background promise chain.
       *
       * Error handling split:
       * - This catch: tRPC/network errors (connection, stream, abort)
       * - Reassembler catch: processing errors (malformed particles, async work)
       */
      for await (const particle of particleStream)
        reassembler.enqueueWireParticle(particle);

      // stop the deadline decimator before the await, as we're done basically
      sendContentUpdate?.stop?.();

      // synchronize any pending async tasks
      await reassembler.waitForWireComplete();

    } catch (error: any) {

      // stop the deadline decimator, as we're into error handling mode now
      sendContentUpdate?.stop?.();

      // store the resume handle, if got one
      if (accumulator_LL.genUpstreamHandle) rsm.resumeHandle = accumulator_LL.genUpstreamHandle;

      // classify error
      const { errorType, errorMessage } = aixClassifyStreamingError(error, abortSignal.aborted, !!accumulator_LL.fragments.length);
      const maybeErrorStatusCode = error?.status || error?.response?.status || undefined;

      // retry decision
      const shallRetry = rsm.shallRetry(errorType, maybeErrorStatusCode);
      if (!shallRetry) {

        // NOT retryable: e.g. client-abort, or missing handle
        if (errorType === 'client-aborted')
          await reassembler.setClientAborted().catch(console.error /* never */);
        else {
          const errorHint: DMessageErrorPart['hint'] = `aix-${errorType}`; // MUST MATCH our `aixClassifyStreamingError` hints with 'aix-<type>' in DMessageErrorPart
          await reassembler.setClientExcepted(errorMessage, errorHint).catch(console.error);
        }
        // ... fall through (traditional single path)

      } else {

        // fragment-notify of our ongoing retry attempt
        try {
          await reassembler.setClientRetrying(shallRetry.strategy, errorMessage, shallRetry.attemptNumber, 0, shallRetry.delayMs, typeof maybeErrorStatusCode === 'number' ? maybeErrorStatusCode : undefined, errorType);
          await onGenerateContentUpdate?.(accumulator_LL, false /* partial */);
        } catch (e) {
          // .. ignore the notification error
        }

        // delay then RETRY
        const stepResult = await rsm.delayedStep(shallRetry.delayMs, abortSignal);
        if (stepResult === 'completed')
          continue; // -> Loop

        // user-aborted during retry-backoff
        await reassembler.setClientAborted().catch(console.error);
        // ... fall through (aborted during backoff)

      }
    }
    // NOTE: sooner or later we fall through on this code path, maybe looped or not, maybe with good data or maybe with reassembled errors...

    // and we're done
    reassembler.finalizeAccumulator();

    // final update bypasses decimation entirely and contains complete content
    await onGenerateContentUpdate?.(accumulator_LL, true /* Last message, done */);

    // return the final accumulated message
    return accumulator_LL;
  }
}
