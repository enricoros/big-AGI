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
  hidden: boolean;                  // hidden from UI selectors

  // hard properties (overwritten on update)
  contextTokens: number | null;     // null: must assume it's unknown
  maxOutputTokens: number | null;   // null: must assume it's unknown
  trainingDataCutoff?: string;      // 'Apr 2029'
  interfaces: DModelInterfaceV1[];  // if set, meaning this is the known and comprehensive set of interfaces
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
  | 'oai-needs-audio'
  | 'gem-code-execution'
  | 'outputs-audio'            // TEMP: ui flag - supports audio output (e.g., text-to-speech)
  | 'outputs-image'            // TEMP: ui flag - supports image output (image generation)
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
export const LLM_IF_Tools_WebSearch: DModelInterfaceV1 = 'tools-web-search';
export const LLM_IF_OAI_Complete: DModelInterfaceV1 = 'oai-complete';
export const LLM_IF_ANT_PromptCaching: DModelInterfaceV1 = 'ant-prompt-caching';
export const LLM_IF_OAI_PromptCaching: DModelInterfaceV1 = 'oai-prompt-caching';
export const LLM_IF_OAI_Realtime: DModelInterfaceV1 = 'oai-realtime';
export const LLM_IF_OAI_NeedsAudio: DModelInterfaceV1 = 'oai-needs-audio';
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
  LLM_IF_Tools_WebSearch,     // Models with web search capability (Perplexity, GPT-4o Search, etc.)
  // Vendor-specific capabilities
  LLM_IF_ANT_PromptCaching,   // [Anthropic] model supports anthropic-specific caching
  LLM_IF_GEM_CodeExecution,   // [Gemini] Tool: code execution
  LLM_IF_OAI_PromptCaching,   // [OpenAI] model supports OpenAI prompt caching
  LLM_IF_OAI_Realtime,        // [OpenAI] realtime API support - unused
  // Hotfixes to patch specific model quirks
  LLM_IF_HOTFIX_NoStream,     // disable streaming (e.g., o1-preview(old))
  LLM_IF_HOTFIX_NoTemperature,// disable temperature parameter (e.g., deepseek-r1)
  LLM_IF_HOTFIX_StripImages,  // remove images from input (e.g. o3-mini-2025-01-31)
  LLM_IF_HOTFIX_StripSys0,    // strip system instruction (e.g. Gemini Image Generation 2025-03-13), excludes Sys0ToUsr0
  LLM_IF_HOTFIX_Sys0ToUsr0,   // downgrade system to user messages for this model (e.g. o1-mini-2024-09-12)
  // old/unused
  LLM_IF_OAI_Complete,        // UNUSED - older text completion, pre-chats
  LLM_IF_OAI_NeedsAudio,      // audio input processing
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
