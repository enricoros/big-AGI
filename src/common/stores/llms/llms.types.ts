//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DModelParameterId, DModelParameterSpec, DModelParameterValues } from './llms.parameters';
import type { DModelPricing } from './llms.pricing';
import type { DModelsServiceId } from './llms.service.types';


/**
 * Identifies a model in the DB. Used to refer to Big-AGI client-side models, by their
 * IDs only. E.g. will use hooks with the store to react to them.
 */
export type DLLMId = string;

/**
 * Large Language Model - description and configuration (data object, stored)
 */
export interface DLLM {
  id: DLLMId;

  // editable properties (kept on update, if isEdited)
  label: string;
  created: number | 0;
  updated?: number | 0;
  description: string;
  hidden: boolean;                  // default hidden state (can change underlying between refreshes)

  // hard properties (overwritten on update)
  contextTokens: DLLMContextTokens;     // null: must assume it's unknown
  maxOutputTokens: DLLMMaxOutputTokens; // null: must assume it's unknown
  trainingDataCutoff?: string;          // 'Apr 2029'
  interfaces: DModelInterfaceV1[];      // if set, meaning this is the known and comprehensive set of interfaces
  benchmark?: { cbaElo?: number, cbaMmlu?: number }; // benchmark values
  pricing?: DModelPricing;

  // parameters system
  parameterSpecs: DModelParameterSpec<DModelParameterId>[];
  initialParameters: DModelParameterValues;

  // references
  sId: DModelsServiceId;
  vId: ModelVendorId;

  // user edited properties - if not undefined/missing, they override the others
  userLabel?: string;
  userHidden?: boolean;
  userStarred?: boolean;
  userParameters?: DModelParameterValues; // user has set these parameters
  userContextTokens?: DLLMContextTokens;       // user override for context window
  userMaxOutputTokens?: DLLMMaxOutputTokens;   // user override for max output tokens
  userPricing?: DModelPricing;                 // user override for model pricing
}


/**
 * Context window size in tokens.
 * - number: The context window size in tokens
 * - null: Unset (do not set in the output, do not assume a max value in the UI)
 */
export type DLLMContextTokens = number | null;

/**
 * Maximum output tokens.
 * - number: The maximum number of tokens the model can generate
 * - null: Unset (do not set in the output, do not assume a max value in the UI)
 */
export type DLLMMaxOutputTokens = number | null;


/**
 * Computes the effective visibility of a model, respecting user overrides.
 * Returns true if the model should be hidden from UI selectors.
 *
 * Logic: userHidden takes precedence if set, otherwise falls back to the vendor's hidden value.
 * This allows users to override vendor defaults while still adopting new vendor visibility changes
 * for models they haven't explicitly shown/hidden.
 */
export function isLLMHidden(llm: DLLM): boolean {
  return llm.userHidden ?? llm.hidden ?? false;
}

export function isLLMVisible(llm: DLLM): boolean {
  return !(llm.userHidden ?? llm.hidden ?? false);
}

/**
 * Returns the effective context token limit for a model.
 * Checks user override first, then vendor-specific parameters, then falls back to model default.
 */
export function getLLMContextTokens(llm: DLLM | null): DLLMContextTokens | undefined {
  if (!llm)
    return undefined; // undefined if no model

  // 1. Check user override first
  if (llm.userContextTokens !== undefined)
    return llm.userContextTokens;

  // 2. Check vendor-specific parameter overrides
  // [Anthropic, 1M] Check if this is an Anthropic model with 1M context enabled
  if (llm.vId === 'anthropic') {
    const vndAnt1MContext = llm.userParameters?.llmVndAnt1MContext ?? llm.initialParameters?.llmVndAnt1MContext;
    if (vndAnt1MContext === true)
      return 1_000_000;
  }

  // 3. Fall back to model default
  return llm.contextTokens; // null if unknown
}

/**
 * Returns the effective max output tokens for a model.
 * Checks user override first, then falls back to model default.
 */
export function getLLMMaxOutputTokens(llm: DLLM | null): DLLMMaxOutputTokens | undefined {
  if (!llm)
    return undefined; // undefined if no model

  // Check user override first, then fall back to model default
  return llm.userMaxOutputTokens ?? llm.maxOutputTokens;
}

/**
 * Returns the effective pricing for a model.
 * Checks user override first, then falls back to model default.
 */
export function getLLMPricing(llm: DLLM | null): DModelPricing | undefined {
  if (!llm)
    return undefined; // undefined if no model

  // Check user override first, then fall back to model default
  return llm.userPricing ?? llm.pricing;
}


/// Interfaces ///

// do not change anything below! those will be persisted in data
export type DModelInterfaceV1 =
  | 'oai-chat'
  | 'oai-chat-fn'
  | 'oai-chat-json'
  | 'oai-chat-vision'
  | 'oai-chat-reasoning'
  | 'oai-complete'
  | 'ant-prompt-caching'
  | 'oai-prompt-caching'
  | 'oai-realtime'
  | 'oai-responses'
  | 'gem-code-execution'
  | 'outputs-audio'            // TEMP: ui flag - supports audio output (e.g., text-to-speech)
  | 'outputs-image'            // TEMP: ui flag - supports image output (image generation)
  | 'outputs-no-text'          // disable text outputs (used in conjunction with alt-outputs) - assumed off
  | 'tools-web-search'         // TEMP: ui flag - supports integrated web search tool
  | 'hotfix-no-stream'         // disable streaming for o1-preview (old) and o1 (20241217)
  | 'hotfix-no-temperature'    // disable temperature for deepseek-r1
  | 'hotfix-strip-images'      // strip images from the input
  | 'hotfix-strip-sys0'        // strip the system instruction (unsupported)
  | 'hotfix-sys0-to-usr0'      // cast sys0 to usr0
  ;

// Model interfaces (chat, and function calls) - here as a preview, will be used more broadly in the future
// FIXME: keep this in sync with the server side on modules/llms/server/llm.server.types.ts
export const LLM_IF_OAI_Chat: DModelInterfaceV1 = 'oai-chat';
export const LLM_IF_OAI_Fn: DModelInterfaceV1 = 'oai-chat-fn';
export const LLM_IF_OAI_Json: DModelInterfaceV1 = 'oai-chat-json'; // for Structured Outputs (or JSON mode at worst)
// export const LLM_IF_OAI_JsonSchema: ... future?
export const LLM_IF_OAI_Vision: DModelInterfaceV1 = 'oai-chat-vision';
export const LLM_IF_OAI_Reasoning: DModelInterfaceV1 = 'oai-chat-reasoning';
export const LLM_IF_Outputs_Audio: DModelInterfaceV1 = 'outputs-audio';
export const LLM_IF_Outputs_Image: DModelInterfaceV1 = 'outputs-image';
export const LLM_IF_Outputs_NoText: DModelInterfaceV1 = 'outputs-no-text';
export const LLM_IF_Tools_WebSearch: DModelInterfaceV1 = 'tools-web-search';
export const LLM_IF_OAI_Complete: DModelInterfaceV1 = 'oai-complete';
export const LLM_IF_ANT_PromptCaching: DModelInterfaceV1 = 'ant-prompt-caching';
export const LLM_IF_OAI_PromptCaching: DModelInterfaceV1 = 'oai-prompt-caching';
export const LLM_IF_OAI_Realtime: DModelInterfaceV1 = 'oai-realtime';
export const LLM_IF_OAI_Responses: DModelInterfaceV1 = 'oai-responses';
export const LLM_IF_GEM_CodeExecution: DModelInterfaceV1 = 'gem-code-execution';
export const LLM_IF_HOTFIX_NoStream: DModelInterfaceV1 = 'hotfix-no-stream';
export const LLM_IF_HOTFIX_NoTemperature: DModelInterfaceV1 = 'hotfix-no-temperature';
export const LLM_IF_HOTFIX_StripImages: DModelInterfaceV1 = 'hotfix-strip-images';
export const LLM_IF_HOTFIX_StripSys0: DModelInterfaceV1 = 'hotfix-strip-sys0';
export const LLM_IF_HOTFIX_Sys0ToUsr0: DModelInterfaceV1 = 'hotfix-sys0-to-usr0';

// TODO: just remove this, and move to a capabilities array (I/O/...)
// FIXME: keep this in sync with the client side on llms.types.ts
export const LLMS_ALL_INTERFACES = [
  // Declare common capabilities
  LLM_IF_OAI_Chat,            // MUST SUPPORT - chat interface
  LLM_IF_OAI_Vision,          // GREAT TO HAVE - image inputs
  LLM_IF_OAI_Fn,              // IMPORTANT - support for function calls
  LLM_IF_OAI_Json,            // not used for now: structured outputs
  // Generalized capabilities
  LLM_IF_OAI_Reasoning,       // COSMETIC ONLY - may show a 'brain' icon in supported screens
  LLM_IF_Outputs_Audio,       // COSMETIC ONLY FOR NOW - Models that generate audio output (TTS models)
  LLM_IF_Outputs_Image,       // COSMETIC ONLY FOR NOW - Models that can generate images (Gemini, DALL-E, etc.)
  LLM_IF_Outputs_NoText,      // Disable Text Outputs - e.g. Gemini pure TTS
  LLM_IF_Tools_WebSearch,     // Models with web search capability (Perplexity, GPT-4o Search, etc.)
  // Vendor-specific capabilities
  LLM_IF_ANT_PromptCaching,   // [Anthropic] model supports anthropic-specific caching
  LLM_IF_GEM_CodeExecution,   // [Gemini] Tool: code execution
  LLM_IF_OAI_PromptCaching,   // [OpenAI] model supports OpenAI prompt caching
  LLM_IF_OAI_Realtime,        // [OpenAI] realtime API support - unused
  LLM_IF_OAI_Responses,       // [OpenAI] Responses API (new) support
  // Hotfixes to patch specific model quirks
  LLM_IF_HOTFIX_NoStream,     // disable streaming (e.g., o1-preview(old))
  LLM_IF_HOTFIX_NoTemperature,// disable temperature parameter (e.g., deepseek-r1)
  LLM_IF_HOTFIX_StripImages,  // remove images from input (e.g. o3-mini-2025-01-31)
  LLM_IF_HOTFIX_StripSys0,    // strip system instruction (e.g. Gemini Image Generation 2025-03-13), excludes Sys0ToUsr0
  LLM_IF_HOTFIX_Sys0ToUsr0,   // downgrade system to user messages for this model (e.g. o1-mini-2024-09-12)
  // old/unused
  LLM_IF_OAI_Complete,        // UNUSED - older text completion, pre-chats
] as const;

// Future changes?
// export type DModelPartKind = 'text' | 'image' | 'audio' | 'video' | 'pdf';
// export type DModelCapability =
//   | 'input-text'
//   | 'input-image-data'
//   | 'input-multipart'
//   | 'output-text'
//   | 'output-function'
//   | 'output-image-data'
//   | 'if-chat'
//   | 'if-fast-chat'
//   ;
// modelcaps: DModelCapability[];
// inputTypes: {                     // future? the supported input formats
//   [key in DModelPartKind]?: {
//     // maxItemsPerInput?: number;
//     // maxFileSize?: number; // in bytes
//     // maxDurationPerInput?: number; // in seconds, for audio and video
//     // maxPagesPerInput?: number; // for PDF
//     // encodings?: ('base64' | 'utf-8')[];
//     mimeTypes?: string[];
//   }
// };
