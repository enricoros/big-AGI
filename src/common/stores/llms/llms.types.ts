//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DModelParameterId, DModelParameterSpec, DModelParameterValues } from './llms.parameters';
import type { DModelPricing } from './llms.pricing';
import type { DModelsServiceId } from './modelsservice.types';


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
  | 'hotfix-no-stream'         // disable streaming for o1-preview (old) and o1 (20241217)
  | 'hotfix-strip-images'      // strip images from the input
  | 'hotfix-sys0-to-usr0'      // cast sys0 to usr0
  ;

// Model interfaces (chat, and function calls) - here as a preview, will be used more broadly in the future
// FIXME: keep this in sync with the server side on modules/llms/server/llm.server.types.ts
export const LLM_IF_OAI_Chat: DModelInterfaceV1 = 'oai-chat';
export const LLM_IF_OAI_Fn: DModelInterfaceV1 = 'oai-chat-fn';
export const LLM_IF_OAI_Json: DModelInterfaceV1 = 'oai-chat-json';
// export const LLM_IF_OAI_JsonSchema: ... future?
export const LLM_IF_OAI_Vision: DModelInterfaceV1 = 'oai-chat-vision';
export const LLM_IF_OAI_Reasoning: DModelInterfaceV1 = 'oai-chat-reasoning';
export const LLM_IF_OAI_Complete: DModelInterfaceV1 = 'oai-complete';
export const LLM_IF_ANT_PromptCaching: DModelInterfaceV1 = 'ant-prompt-caching';
export const LLM_IF_OAI_PromptCaching: DModelInterfaceV1 = 'oai-prompt-caching';
export const LLM_IF_OAI_Realtime: DModelInterfaceV1 = 'oai-realtime';
export const LLM_IF_OAI_NeedsAudio: DModelInterfaceV1 = 'oai-needs-audio';
export const LLM_IF_GEM_CodeExecution: DModelInterfaceV1 = 'gem-code-execution';
export const LLM_IF_HOTFIX_NoStream: DModelInterfaceV1 = 'hotfix-no-stream';
export const LLM_IF_HOTFIX_StripImages: DModelInterfaceV1 = 'hotfix-strip-images';
export const LLM_IF_HOTFIX_Sys0ToUsr0: DModelInterfaceV1 = 'hotfix-sys0-to-usr0';

// TODO: just remove this, and move to a capabilities array (I/O/...)
// FIXME: keep this in sync with the client side on llms.types.ts
export const LLMS_ALL_INTERFACES = [
  LLM_IF_OAI_Chat,
  LLM_IF_OAI_Fn,
  LLM_IF_OAI_Json,
  LLM_IF_OAI_Vision,
  LLM_IF_OAI_Reasoning,
  LLM_IF_OAI_Complete,
  LLM_IF_ANT_PromptCaching,
  LLM_IF_OAI_PromptCaching,
  LLM_IF_OAI_Realtime,
  LLM_IF_OAI_NeedsAudio,
  LLM_IF_GEM_CodeExecution,
  LLM_IF_HOTFIX_NoStream,
  LLM_IF_HOTFIX_StripImages,
  LLM_IF_HOTFIX_Sys0ToUsr0,
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
