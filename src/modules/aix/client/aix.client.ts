import { findServiceAccessOrThrow } from '~/modules/llms/vendors/vendor.helpers';

import type { MaybePromise } from '~/common/types/useful.types';
import { AIVndAntInlineFilesPolicy, getVndAntInlineFiles } from '~/common/stores/store-ai';
import { AudioPlayer } from '~/common/util/audio/AudioPlayer';
import { DLLM, DLLMId, LLM_IF_HOTFIX_NoTemperature, LLM_IF_OAI_Responses, LLM_IF_Outputs_Audio, LLM_IF_Outputs_Image, LLM_IF_Outputs_NoText } from '~/common/stores/llms/llms.types';
import { DMessage, DMessageGenerator, createGeneratorAIX_AutoLabel } from '~/common/stores/chat/chat.message';
import { DMetricsChatGenerate_Lg, DMetricsChatGenerate_Md, metricsChatGenerateLgToMd, metricsComputeChatGenerateCostsMd, } from '~/common/stores/metrics/metrics.chatgenerate';
import { DModelParameterValues, getAllModelParameterValues } from '~/common/stores/llms/llms.parameters';
import { apiStream } from '~/common/util/trpc.client';
import { createErrorContentFragment, DMessageContentFragment, DMessageErrorPart, DMessageVoidFragment, isContentFragment, isErrorPart } from '~/common/stores/chat/chat.fragments';
import { findLLMOrThrow } from '~/common/stores/llms/store-llms';
import { getAixInspectorEnabled } from '~/common/stores/store-ui';
import { getLabsLosslessImages } from '~/common/stores/store-ux-labs';
import { llmChatPricing_adjusted } from '~/common/stores/llms/llms.pricing';
import { metricsStoreAddChatGenerate } from '~/common/stores/metrics/store-metrics';
import { stripUndefined } from '~/common/util/objectUtils';
import { webGeolocationCached } from '~/common/util/webGeolocationUtils';

// NOTE: pay particular attention to the "import type", as this is importing from the server-side Zod definitions
import type { AixAPI_Access, AixAPI_ConnectionOptions_ChatGenerate, AixAPI_Context_ChatGenerate, AixAPI_Model, AixAPIChatGenerate_Request, AixWire_Particles } from '../server/api/aix.wiretypes';

import { AixStreamRetry } from './aix.client.retry';
import { ContentReassembler } from './ContentReassembler';
import { aixCGR_ChatSequence_FromDMessagesOrThrow, aixCGR_FromSimpleText, aixCGR_SystemMessage_FromDMessageOrThrow, AixChatGenerate_TextMessages, clientHotFixGenerateRequest_ApplyAll } from './aix.client.chatGenerateRequest';
import { aixClassifyStreamingError } from './aix.client.errors';
import { aixClientDebuggerGetRBO, getAixDebuggerNoStreaming } from './debugger/memstore-aix-client-debugger';
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
    llmRef, llmTemperature, llmResponseTokens, llmTopP, llmForceNoStream,
    llmVndAntEffort, llmVndGemEffort, llmVndOaiEffort, llmVndMiscEffort,
    llmVndAnt1MContext, llmVndAntInfSpeed, llmVndAntSkills, llmVndAntThinkingBudget, llmVndAntWebDynamic, llmVndAntWebFetch, llmVndAntWebFetchMaxUses, llmVndAntWebSearch, llmVndAntWebSearchMaxUses,
    llmVndBedrockAPI,
    llmVndGeminiAspectRatio, llmVndGeminiImageSize, llmVndGeminiCodeExecution, llmVndGeminiComputerUse, llmVndGeminiGoogleSearch, llmVndGeminiMediaResolution, llmVndGeminiThinkingBudget,
    // llmVndMoonshotWebSearch,
    llmVndOaiRestoreMarkdown, llmVndOaiVerbosity, llmVndOaiWebSearchContext, llmVndOaiWebSearchGeolocation, llmVndOaiImageGeneration, llmVndOaiCodeInterpreter,
    llmVndOrtWebSearch,
    llmVndPerplexityDateFilter, llmVndPerplexitySearchMode,
    llmVndXaiCodeExecution, llmVndXaiSearchInterval, llmVndXaiWebSearch, llmVndXaiXSearch, llmVndXaiXSearchHandles,
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

  return stripUndefined({
    id: llmRef,
    acceptsOutputs: acceptsOutputs,
    temperature: (hotfixOmitTemperature || llmTemperature === null) ? null : llmTemperature, // strippable
    maxTokens: llmResponseTokens ?? undefined, // strippable - null: like undefined -> strip -> omit the value
    topP: llmTopP, // strippable (likely)
    forceNoStream: llmForceNoStream ? true : undefined, // strippable
    userGeolocation: userGeolocation, // strippable (likely)

    // Cross-provider unified options
    reasoningEffort: llmVndAntEffort ?? llmVndGemEffort ?? llmVndOaiEffort ?? llmVndMiscEffort, // strippable

    // Anthropic - (vndAntContainerId, vndAntTransformInlineFiles are set in the decorate function)
    ...(llmVndAntThinkingBudget !== undefined ? { vndAntThinkingBudget: llmVndAntThinkingBudget === -1 ? 'adaptive' as const : llmVndAntThinkingBudget } : {}),
    ...(llmVndAnt1MContext ? { vndAnt1MContext: llmVndAnt1MContext } : {}),
    ...(llmVndAntInfSpeed === 'fast' ? { vndAntInfSpeed: 'fast' } : {}),
    ...(llmVndAntSkills ? { vndAntSkills: llmVndAntSkills } : {}),
    ...(llmVndAntWebDynamic ? { vndAntWebDynamic: true } : {}),
    ...(llmVndAntWebFetch === 'auto' ? { vndAntWebFetch: llmVndAntWebFetch, ...(llmVndAntWebFetchMaxUses ? { vndAntWebFetchMaxUses: llmVndAntWebFetchMaxUses } : {}) } : {}),
    ...(llmVndAntWebSearch === 'auto' ? { vndAntWebSearch: llmVndAntWebSearch, ...(llmVndAntWebSearchMaxUses ? { vndAntWebSearchMaxUses: llmVndAntWebSearchMaxUses } : {}) } : {}),

    // Bedrock
    ...(llmVndBedrockAPI ? { vndBedrockAPI: llmVndBedrockAPI } : {}),

    // Gemini
    ...(llmVndGeminiAspectRatio ? { vndGeminiAspectRatio: llmVndGeminiAspectRatio } : {}),
    ...(llmVndGeminiCodeExecution === 'auto' ? { vndGeminiCodeExecution: llmVndGeminiCodeExecution } : {}),
    ...(llmVndGeminiComputerUse ? { vndGeminiComputerUse: llmVndGeminiComputerUse } : {}),
    ...(llmVndGeminiGoogleSearch ? {
      vndGeminiGoogleSearch: llmVndGeminiGoogleSearch,
      vndGeminiUrlContext: 'auto', // NOTE: we are now driving both from the client side, search and fetch, without a dedicated setting, for UX simplicity
    } : {}),
    ...(llmVndGeminiImageSize ? { vndGeminiImageSize: llmVndGeminiImageSize } : {}),
    ...(llmVndGeminiMediaResolution ? { vndGeminiMediaResolution: llmVndGeminiMediaResolution } : {}),
    ...(llmVndGeminiThinkingBudget !== undefined ? { vndGeminiThinkingBudget: llmVndGeminiThinkingBudget } : {}),
    // ...(llmVndGeminiUrlContext === 'auto' ? { vndGeminiUrlContext: llmVndGeminiUrlContext } : {}),

    // Moonshot
    // ...(llmVndMoonshotWebSearch === 'auto' ? { vndMoonshotWebSearch: 'auto' } : {}),

    // OpenAI
    ...(llmVndOaiResponsesAPI ? { vndOaiResponsesAPI: true } : {}),
    ...(llmVndOaiRestoreMarkdown ? { vndOaiRestoreMarkdown: llmVndOaiRestoreMarkdown } : {}),
    ...(llmVndOaiVerbosity ? { vndOaiVerbosity: llmVndOaiVerbosity } : {}),
    ...(llmVndOaiWebSearchContext ? { vndOaiWebSearchContext: llmVndOaiWebSearchContext } : {}),
    ...(llmVndOaiImageGeneration ? { vndOaiImageGeneration: (llmVndOaiImageGeneration as any /* backward comp */) === true ? 'mq' : llmVndOaiImageGeneration } : {}),
    ...(llmVndOaiCodeInterpreter === 'auto' ? { vndOaiCodeInterpreter: llmVndOaiCodeInterpreter } : {}),

    // OpenRouter
    ...(llmVndOrtWebSearch === 'auto' ? { vndOrtWebSearch: 'auto' } : {}),

    // Perplexity
    ...(llmVndPerplexityDateFilter ? { vndPerplexityDateFilter: llmVndPerplexityDateFilter } : {}),
    ...(llmVndPerplexitySearchMode ? { vndPerplexitySearchMode: llmVndPerplexitySearchMode } : {}),

    // xAI
    ...(llmVndXaiCodeExecution === 'auto' ? { vndXaiCodeExecution: llmVndXaiCodeExecution } : {}),
    ...(llmVndXaiSearchInterval ? { vndXaiSearchInterval: llmVndXaiSearchInterval } : {}),
    ...(llmVndXaiWebSearch === 'auto' ? { vndXaiWebSearch: llmVndXaiWebSearch } : {}),
    ...(llmVndXaiXSearch === 'auto' ? { vndXaiXSearch: llmVndXaiXSearch } : {}),
    ...(llmVndXaiXSearchHandles ? { vndXaiXSearchHandles: llmVndXaiXSearchHandles } : {}),
  });
}

export function aixDecorateModelFromGlobals(model: AixAPI_Model, decorations: {
  // [Anthropic Container] Container ID from a prior turn (caller is responsible for expiry checks)
  vndAntContainerId?: string;
  // [Anthropic File Inlining] Global user policy; 'off' means don't decorate (caller can pass it raw)
  vndAntTransformInlineFiles?: AIVndAntInlineFilesPolicy;
}): void {

  // [Anthropic Container] Inject session state from a prior turn
  if (decorations.vndAntContainerId)
    model.vndAntContainerId = decorations.vndAntContainerId;

  // [Anthropic File Inlining] Apply only when not 'off' - the wire enum doesn't include 'off'
  if (decorations.vndAntTransformInlineFiles && decorations.vndAntTransformInlineFiles !== 'off')
    model.vndAntTransformInlineFiles = decorations.vndAntTransformInlineFiles;

}


interface AixClientOptions {
  abortSignal: AbortSignal | 'NON_ABORTABLE'; // 'NON_ABORTABLE' is a special case for non-abortable operations
  throttleParallelThreads?: number; // 0: disable, 1: default throttle (12Hz), 2+ reduce frequency with the square root

  // LLM parameter configuration layers: full replacement of user params and/or overrides of a set of individual params
  llmUserParametersReplacement?: DModelParameterValues; // can replace the 'global' llm user configuration with an alternate config (e.g. persona, or per-chat)
  llmOptionsOverride?: Omit<DModelParameterValues, 'llmRef'>; // overrides (sets/replaces) individual LLM parameters

  // -- Session State - extract? --
  // [Anthropic Container] Container ID from a prior turn (caller checks expiry before setting)
  antContainerId?: string;
}


// --- L3 - Conversation-level generation (builds chat request, error wrapping) ---

/** L3 return: final DMessage-compatible object + terminal outcome. errorMessage is only set for pre-LL errors. */
export type AixChatGenerateContent_FromConversation_Result = {
  lastDMessage: AixChatGenerateContent_DMessageGuts,
  outcome: AixChatGenerateTerminal_LL,
  outcomeFailedMessage?: string,
};

/**
 * Level 3 Generation from an LLM Id + Chat History.
 * Updates use Zustand-style immutable references: .fragments and .generator are new objects on each update.
 * Callers can pass the update directly to stores without deep cloning.
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
): Promise<AixChatGenerateContent_FromConversation_Result> {

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

    // [Anthropic Container] Session resolution: walk history backwards to find the most recent
    // unexpired container. Stops at the first container found (same session = same container;
    // older containers from the same session would be at least as expired).
    if (!clientOptions.antContainerId)
      for (let i = chatHistoryWithoutSystemMessages.length - 1; i >= 0; i--) {
        const uc = chatHistoryWithoutSystemMessages[i].generator?.upstreamContainer;
        if (uc?.uct === 'vnd.ant.container') {
          const remainingMs = Date.parse(uc.expiresAt) - Date.now();
          if (remainingMs <= 15_000)
            console.log(`[DEV] AIX: Anthropic container ${uc.containerId} expired ${Math.round(-remainingMs / 1000)}s ago, not reusing.`);
          else
            clientOptions = { ...clientOptions, antContainerId: uc.containerId };
          break;
        }
      }

    const { outcome, ...resultDMessage } = await aixChatGenerateContent_DMessage_orThrow(
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

    return { outcome, lastDMessage: resultDMessage };

  } catch (error: any) {

    // pre-LL error (e.g. LLM not found, service misconfigured, content assembly error) - the LL likly never ran
    console.warn('[DEV] aixChatGenerateContent error:', { error });
    const errorMessage = error.message || (typeof error === 'string' ? error : 'Chat stopped.');
    lastDMessage = {
      fragments: [...lastDMessage.fragments, createErrorContentFragment(`Issue: ${errorMessage}`)],
      generator: { ...lastDMessage.generator, tokenStopReason: 'issue' },
      pendingIncomplete: false,
    }
    return { outcome: 'failed', lastDMessage, outcomeFailedMessage: errorMessage };

  }
}


// --- L2-Simple - Text-only facade (resolves LLM, calls LL, returns string) ---

/**
 * L2-S - Accumulator for the simple text-only API
 */
interface _AixChatGenerateText_Simple {
  text: string | null;
  generator: DMessageGenerator;
  isDone: boolean;
}

/**
 * L2-S - Simpler facade to text-only inputs and text-only outputs - and nothing else. Old-school V1-like API.
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
  const { shallDisableStreaming } = await clientHotFixGenerateRequest_ApplyAll(llm.interfaces, aixChatGenerate, llmParameters.llmRef || llm.id);
  if (shallDisableStreaming || aixModel.forceNoStream)
    aixStreaming = false;


  // Variable to store the final text
  const state: _AixChatGenerateText_Simple = {
    text: null,
    generator: createGeneratorAIX_AutoLabel(llm.vId, llm.id),
    isDone: false,
  };

  // NO streaming initial notification - only notified past the first real characters
  // await onTextStreamUpdate?.(dText.text, false);

  // apply any vendor-specific rate limit
  await llmVendor.rateLimitChatGenerate?.(llm, llmServiceSettings);


  // Abort: if no signal is provided, we will create a dummy signal
  const abortSignal = (clientOptions?.abortSignal && clientOptions.abortSignal !== 'NON_ABORTABLE') ? clientOptions?.abortSignal
    : new AbortController().signal; // since this is a 'simple' low-stakes API, we can 'ignore' the abort signal and not enforce it with the caller


  // Aix LL Chat Generation - does not throw, but may return an error in the final text
  const { cgMetricsLg, outcome, ...llFinal } = await _aixChatGenerateContent_LL(
    aixAccess,
    aixModel,
    aixChatGenerate,
    aixContext,
    aixStreaming,
    state.generator,
    abortSignal,
    clientOptions?.throttleParallelThreads ?? 0,
    !aixStreaming ? undefined : async (ll: AixChatGenerateContent_LL, _isDone: boolean /* we want to issue this, in case the next action is an exception */) => {
      _llToL2Simple(ll, state);
      if (onTextStreamUpdate && state.text !== null)
        await onTextStreamUpdate(state.text, false, state.generator);
    },
  );

  // Mark as complete
  state.isDone = true;

  // LLM Cost computation & Aggregations
  _llToL2Simple(llFinal, state);
  const metrics = _finalizeLlmMetricsWithCosts(cgMetricsLg, llm, `aix_chatgenerate_text-${aixContextName}`);
  if (metrics) state.generator = { ...state.generator, metrics };


  // re-throw the user-initiated abort, as the former function catches it
  if (abortSignal.aborted)
    throw new DOMException('Stopped.', 'AbortError');

  // throw if there was no text generated
  if (state.text === null)
    throw new Error('AIX: Empty text response.');

  // throw if there are error fragments
  const errorMessage = llFinal.fragments
    .filter(f => isContentFragment(f) && isErrorPart(f.part))
    .map(f => (f.part as DMessageErrorPart).error).join('\n');
  if (errorMessage)
    throw new Error('AIX: Error in response: ' + errorMessage);

  // throw if the outcome is failed
  if (outcome === 'failed')
    throw new Error('AIX: Generation failed.');

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
function _llToL2Simple({ fragments, generator }: AixChatGenerateContent_LL, dest: _AixChatGenerateText_Simple) {
  // transfer generator by reference - already structurally shared
  dest.generator = generator;

  // ll.fragments[] -> dest.text (with error handling)
  // NOTE: similar to messageFragmentsReduceText, but with a more adapted behavior and throwing
  if (!fragments.length) return; // keep dest.text as null until first content arrives
  dest.text = '';
  for (const fragment of fragments) {
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
      case 'hosted_resource': // impossible - download-only artifact
      case 'tool_response': // impossible - stopped at the invocation already
      case '_pt_sentinel': // impossible
        break;
      default:
        const _exhaustiveCheck: never = pt;
    }
  }
}


// --- L2 - DMessage generation (resolves LLM, calls LL, finalizes costs, returns DMessageGuts + outcome) ---

/**
 * L2 Accumulator for ChatGenerate DMessage output data, as it is being streamed.
 * Uses Zustand-style immutable references: .fragments and .generator are replaced (not mutated) on each update.
 */
export interface AixChatGenerateContent_DMessageGuts extends Pick<DMessage, 'fragments' | 'generator' | 'pendingIncomplete'> {
  fragments: (DMessageContentFragment | DMessageVoidFragment /* no AttachmentFragments */)[];
  // Since 'aixChatGenerateContent_DMessage_FromConversation' starts from named (before replacement from LL), we can't Extract
  generator: DMessageGenerator; // Extract<DMessageGenerator, { mgt: 'aix' }>;
  pendingIncomplete: boolean;
}

/** L2 return type: DMessage-compatible guts + LL outcome (kept separate to prevent leaking into stores) */
type _AixChatGenerateContent_DMessageGuts_WithOutcome = AixChatGenerateContent_DMessageGuts & {
  outcome: AixChatGenerateTerminal_LL;
};

/**
 * Level 2 - Generates chat content using a specified LLM and ChatGenerateRequest (incl. Tools) and returns a DMessage-compatible object.
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
): Promise<_AixChatGenerateContent_DMessageGuts_WithOutcome> {

  // Aix Access
  const llm = findLLMOrThrow(llmId);
  const { transportAccess: aixAccess, vendor: llmVendor, serviceSettings: llmServiceSettings } = findServiceAccessOrThrow<TServiceSettings, TAccess>(llm.sId);

  // Aix Model
  const llmParameters = getAllModelParameterValues(llm.initialParameters, clientOptions?.llmUserParametersReplacement ?? llm.userParameters);
  const aixModel = aixCreateModelFromLLMOptions(llm.interfaces, llmParameters, clientOptions?.llmOptionsOverride, llmId);
  aixDecorateModelFromGlobals(aixModel, {
    vndAntContainerId: clientOptions?.antContainerId,
    vndAntTransformInlineFiles: aixAccess.dialect === 'anthropic' ? getVndAntInlineFiles() : undefined,
  });

  // Client-side late stage model HotFixes
  const { shallDisableStreaming } = await clientHotFixGenerateRequest_ApplyAll(llm.interfaces, aixChatGenerate, llmParameters.llmRef || llm.id);
  if (shallDisableStreaming || aixModel.forceNoStream)
    aixStreaming = false;

  // Legacy Note: awaited OpenAI moderation check was removed (was only on this codepath)

  // Aix LL Chat Generation
  const dMessage: AixChatGenerateContent_DMessageGuts = {
    fragments: [],
    generator: createGeneratorAIX_AutoLabel(llm.vId, llm.id), // using llm.id (not aixModel.id/ref) so we can re-select them in the UI (Beam)
    pendingIncomplete: true,
  };

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

  // Aix LL Chat Generation
  const { cgMetricsLg, outcome, ...llFinal } = await _aixChatGenerateContent_LL(
    aixAccess,
    aixModel,
    aixChatGenerate,
    aixContext,
    aixStreaming,
    dMessage.generator,
    clientOptions.abortSignal,
    clientOptions.throttleParallelThreads ?? 0,
    async (ll: AixChatGenerateContent_LL, isDone: boolean) => {
      if (isDone) return; // optimization, as there aren't branches between here and the final update below
      if (onStreamingUpdate) {
        _llToDMessageGuts(ll, dMessage);
        await onStreamingUpdate(dMessage, false);
      }
    },
  );

  // Finalize DMessage
  _llToDMessageGuts(llFinal, dMessage);
  const metrics = _finalizeLlmMetricsWithCosts(cgMetricsLg, llm, `aix_chatgenerate_content-${aixContext.name}`);
  if (metrics) dMessage.generator = { ...dMessage.generator, metrics };
  dMessage.pendingIncomplete = false;

  // final update
  await onStreamingUpdate?.(dMessage, true);

  // return DMessageGuts spread + outcome
  return { ...dMessage, outcome };
}

function _llToDMessageGuts({ fragments, generator }: AixChatGenerateContent_LL, dest: AixChatGenerateContent_DMessageGuts) {
  // transfer fragments by reference - safe because the accumulator replaces (never mutates) its arrays
  // cast: LL enforces ReadonlyArray (no .push on accumulator), DMessage uses mutable arrays - the boundary is here
  dest.fragments = fragments as (DMessageContentFragment | DMessageVoidFragment)[];

  // transfer generator by reference - already structurally shared by the reassembler
  dest.generator = generator;
}

function _finalizeLlmMetricsWithCosts(cgMetricsLg: undefined | DMetricsChatGenerate_Lg, llm: DLLM, debugCostSource: string): undefined | DMetricsChatGenerate_Md {
  // Compute the Md metrics from Lg
  let metricsMd = cgMetricsLg ? metricsChatGenerateLgToMd(cgMetricsLg) : undefined;

  // Compute costs
  const logLlmRefId = getAllModelParameterValues(llm.initialParameters, llm.userParameters).llmRef || llm.id;
  const adjChatPricing = llmChatPricing_adjusted(llm);
  const costs = metricsComputeChatGenerateCostsMd(metricsMd, adjChatPricing, logLlmRefId);
  if (!costs) {
    // FIXME: we shall warn that the costs are missing, as the only way to get pricing is through surfacing missing prices
    return metricsMd;
  }
  metricsMd = { ...metricsMd /* TIn, TOut, ... */, ...costs /* $c, ... $code */ };

  // Run aggregations
  const m = metricsMd;
  const inputTokens = (m?.TIn || 0) + (m?.TCacheRead || 0) + (m?.TCacheWrite || 0);
  const outputTokens = (m?.TOut || 0) /* + (m?.TOutR || 0) THIS IS A BREAKDOWN, IT'S ALREADY IN */;
  metricsStoreAddChatGenerate(costs, inputTokens, outputTokens, llm, debugCostSource);

  // Merge costs into a new generator
  return metricsMd;
}


// --- LL Low-Level (Level 1) - Streaming loop with retry/reassembler ---

/**
 * Streaming accumulator for LL ChatGenerate - the live view during streaming.
 *
 * Structural sharing contract (Zustand-style):
 * - .fragments and .generator are REPLACED with new references on each LL update, never mutated in place
 * - Callers receive stable snapshots by reference - safe to forward to stores, do not mutate
 */
export interface AixChatGenerateContent_LL {
  fragments: ReadonlyArray<DMessageContentFragment | DMessageVoidFragment>;
  generator: Readonly<DMessageGenerator>;
}

/**
 * Finalized LL result - extends the streaming accumulator with fields only available after finalization.
 */
export interface AixChatGenerateContent_LL_Result extends AixChatGenerateContent_LL {
  outcome: AixChatGenerateTerminal_LL;
  // Lg metrics - kept separate from generator.metrics (Md) because Lg is richer and used for final summaries
  cgMetricsLg?: DMetricsChatGenerate_Lg;
}

/**
 * Terminal state of a single LL generation call - why it stopped.
 * - 'completed': model responded normally (content may have tokenStopReason detail like out-of-tokens or filter)
 * - 'aborted': user cancelled
 * - 'failed': error occurred (error fragments carry the detail)
 */
export type AixChatGenerateTerminal_LL = 'completed' | 'aborted' | 'failed';

/**
 * LL (Level 1) - Client-side ChatGenerateContent, with optional streaming.
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
 * @param initialGenerator generator initial value, which will be updated for every new piece of information received
 * @param abortSignal allows the caller to stop the operation
 * @param throttleParallelThreads allows the caller to limit the number of parallel threads
 *
 * The output is an accumulator object with the fragments and generator.
 *
 * @param onGenerateContentUpdate updated with the same accumulator at every step, and at the end (with isDone=true)
 * @returns the final accumulator object
 * @throws Error if there are rare LL errors, or if [CSF] client-side fails to load
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
  initialGenerator: DMessageGenerator,
  abortSignal: AbortSignal,
  throttleParallelThreads: number | undefined,
  // optional streaming callback: not fired until the first piece of content
  onGenerateContentUpdate?: (accumulator: AixChatGenerateContent_LL, isDone: boolean) => MaybePromise<void>,
): Promise<AixChatGenerateContent_LL_Result> {

  // Inspector support - can be requested by the client, but granted on the server side
  const inspectorEnabled = getAixInspectorEnabled();
  const inspectorTransport = !inspectorEnabled ? undefined : aixAccess.clientSideFetch ? 'csf' : 'trpc';
  const inspectorContext = !inspectorEnabled ? undefined : { contextName: aixContext.name, contextRef: aixContext.ref };

  // [DEV] Inspector - request body override
  const requestBodyOverrideJson = inspectorEnabled && aixClientDebuggerGetRBO();
  const debugRequestBodyOverride = !requestBodyOverrideJson ? false : JSON.parse(requestBodyOverrideJson);

  /**
   * FIXME: implement client selection of resumability - aixAccess option?
   * For now we turn it on for Responses API for select kinds of request.
   */
  const requestResumability = !!aixModel.vndOaiResponsesAPI &&
    (['conversation', 'beam-scatter', 'beam-gather'] satisfies (AixAPI_Context_ChatGenerate['name'] | string)[]).includes(aixContext.name);

  const aixConnectionOptions: AixAPI_ConnectionOptions_ChatGenerate = {
    ...inspectorEnabled && { debugDispatchRequest: true, debugProfilePerformance: true },
    ...debugRequestBodyOverride && { debugRequestBodyOverride },
    // FIXME: disabled until clearly working
    // ...requestResumability && { enableResumability: true },
  } as const;


  // [CSF] Pre-load client-side executor if needed
  let clientSideChatGenerate: typeof import('./aix.client.direct-chatGenerate').clientSideChatGenerate | undefined = undefined;
  if (aixAccess.clientSideFetch)
    try {
      clientSideChatGenerate = (await import('./aix.client.direct-chatGenerate')).clientSideChatGenerate;
    } catch (error) {
      throw new Error(`Direct connection unsuccessful: ${(error as any)?.message || 'unknown loading error'}`, { cause: error });
    }


  // Particles Reassembler - owns the accumulator, reused across Client-side retries
  const reassembler = new ContentReassembler(
    initialGenerator,
    inspectorTransport,
    inspectorContext,
    getLabsLosslessImages(),
    abortSignal,
    (audio) => {
      const audioUrl = URL.createObjectURL(audio.blob);
      void AudioPlayer.playUrl(audioUrl)
        .catch(error => console.log('[AIX] Failed to play audio:', { error }))
        .finally(() => URL.revokeObjectURL(audioUrl));
    },
  );
  const accumulator_LL = reassembler.S; // stable ref - readonly, same object throughout


  // Retry/Reconnect - LL state machine
  // - reconnect: for server overload/busy (429, 503, 502) and transient errors
  // - resume: for network disconnects with OpenAI Responses API handle
  const rsm = new AixStreamRetry(0, 0); // sensible: 3, 2

  while (true) {

    // fresh decimated callback per iteration (decimator has start/stop lifecycle)
    const sendContentUpdate = !onGenerateContentUpdate ? undefined : withDecimator(throttleParallelThreads ?? 0, 'aixChatGenerateContent', async (accumulator: AixChatGenerateContent_LL, contentStarted: boolean) => {
      /**
       * We want the first caller's update to have actual content.
       * However note that we won't be sending out the model name very fast this way,
       * but it's probably what we want because of the ParticleIndicators (VFX!)
       */
      if (!contentStarted)
        return;

      await onGenerateContentUpdate(accumulator, false);
    });

    // important: update the callback as we recreate the decimator every time
    reassembler.updateCallback = sendContentUpdate;

    try {

      let particleStream: AsyncIterable<AixWire_Particles.ChatGenerateOp, void>;

      // AIX [CSM] Direct Execution
      if (!accumulator_LL.generator.upstreamHandle && clientSideChatGenerate)
        particleStream = clientSideChatGenerate(
          aixAccess,
          aixModel,
          aixChatGenerate,
          aixContext,
          getAixDebuggerNoStreaming() ? false : aixStreaming,
          aixConnectionOptions,
          abortSignal,
        );

      // AIX tRPC Streaming Generation from Chat input
      else if (!accumulator_LL.generator.upstreamHandle)
        particleStream = await apiStream.aix.chatGenerateContent.mutate({
          access: aixAccess,
          model: aixModel,
          chatGenerate: aixChatGenerate,
          context: aixContext,
          streaming: getAixDebuggerNoStreaming() ? false : aixStreaming, // [DEV] disable streaming if set in the UX (testing)
          connectionOptions: aixConnectionOptions,
        }, { signal: abortSignal });

      // AIX tRPC Streaming re-attachment from handle - for LL auto-resume
      else
        particleStream = await apiStream.aix.reattachContent.mutate({
          access: aixAccess,
          resumeHandle: accumulator_LL.generator.upstreamHandle,
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

      // [CSF] generators end cleanly on abort (unlike tRPC which throws) - route to catch
      abortSignal.throwIfAborted();

      // stop the deadline decimator before the await, as we're done basically
      sendContentUpdate?.stop?.();

      // synchronize any pending async tasks
      await reassembler.waitForWireComplete();

      break; // -> terminal: completed

    } catch (error: any) {

      // stop the deadline decimator, as we're into error handling mode now
      sendContentUpdate?.stop?.();

      // drain in-flight processing before any terminal/retry decision (prevents ghost fragments from mid-await particles)
      await reassembler.waitForWireComplete().catch(() => {/* processing errors are already handled internally */});


      // classify error
      const { errorType, errorMessage } = aixClassifyStreamingError(error, abortSignal.aborted, !!accumulator_LL.fragments.length);
      const maybeErrorStatusCode = error?.status || error?.response?.status || undefined;

      // client-side-retry decision - resume handle from accumulator determines strategy (resume vs reconnect)
      const shallRetry = rsm.shallRetry(errorType, maybeErrorStatusCode, !!accumulator_LL.generator.upstreamHandle);
      if (shallRetry) {

        // notify UI of our ongoing retry attempt
        try {
          await reassembler.setClientRetrying(shallRetry.strategy, errorMessage, shallRetry.attemptNumber, 0, shallRetry.delayMs, typeof maybeErrorStatusCode === 'number' ? maybeErrorStatusCode : undefined, errorType);
          await onGenerateContentUpdate?.(accumulator_LL, false);
        } catch (_) {
          // ignore notification errors
        }

        // delay then retry
        const stepResult = await rsm.delayedStep(shallRetry.delayMs, abortSignal);
        if (stepResult === 'completed')
          continue; // -> retry: loop

        // user-aborted during retry backoff
        // ...fall through to classify with the original error
      }

      // Terminal: not retryable, or user-aborted during retry backoff
      if (errorType === 'client-aborted')
        reassembler.setClientAborted();
      else {
        const errorHint: DMessageErrorPart['hint'] = `aix-${errorType}`; // MUST MATCH our `aixClassifyStreamingError` hints with 'aix-<type>' in DMessageErrorPart
        reassembler.setClientExcepted(errorMessage, errorHint);
      }
      break; // -> terminal: failed or aborted
    }
  }


  // Finalize - classify termination, append error fragments, compute outcome
  const llResult = reassembler.finalizeReassembly();

  // final update bypasses decimation entirely and contains complete content
  await onGenerateContentUpdate?.(llResult, true /* only true here */);

  return llResult;
}
