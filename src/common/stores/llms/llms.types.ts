//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

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
export interface DLLM<TLLMOptions = Record<string, any>> {
  id: DLLMId;

  // editable properties (kept on update, if isEdited)
  label: string;
  created: number | 0;
  updated?: number | 0;
  description: string;
  hidden: boolean;                  // hidden from UI selectors
  isEdited?: boolean;               // user has edited the soft properties

  // hard properties (overwritten on update)
  contextTokens: number | null;     // null: must assume it's unknown
  maxOutputTokens: number | null;   // null: must assume it's unknown
  trainingDataCutoff?: string;      // 'Apr 2029'
  interfaces: DModelInterfaceV1[];  // if set, meaning this is the known and comprehensive set of interfaces
  benchmark?: { cbaElo?: number, cbaMmlu?: number }; // benchmark values
  pricing?: DModelPricing;

  // references
  sId: DModelsServiceId;
  vId: ModelVendorId;

  // llm-specific
  options: { llmRef: string } & Partial<TLLMOptions>;
}


/// Interfaces ///

// do not change anything below! those will be persisted in data
export type DModelInterfaceV1 =
  | 'oai-chat'
  | 'oai-chat-json'
  | 'oai-chat-vision'
  | 'oai-chat-fn'
  | 'oai-complete'
  | 'ant-prompt-caching'
  | 'oai-o1-preview'
  | 'oai-prompt-caching'
  | 'oai-realtime'
  ;

// Model interfaces (chat, and function calls) - here as a preview, will be used more broadly in the future
// FIXME: keep this in sync with the server side on modules/llms/server/llm.server.types.ts
export const LLM_IF_OAI_Chat: DModelInterfaceV1 = 'oai-chat';
export const LLM_IF_OAI_Json: DModelInterfaceV1 = 'oai-chat-json';
// export const LLM_IF_OAI_JsonSchema: ... future?
export const LLM_IF_OAI_Vision: DModelInterfaceV1 = 'oai-chat-vision';
export const LLM_IF_OAI_Fn: DModelInterfaceV1 = 'oai-chat-fn';
export const LLM_IF_OAI_Complete: DModelInterfaceV1 = 'oai-complete';
export const LLM_IF_ANT_PromptCaching: DModelInterfaceV1 = 'ant-prompt-caching';
export const LLM_IF_SPECIAL_OAI_O1Preview: DModelInterfaceV1 = 'oai-o1-preview';
export const LLM_IF_OAI_PromptCaching: DModelInterfaceV1 = 'oai-prompt-caching';
export const LLM_IF_OAI_Realtime: DModelInterfaceV1 = 'oai-realtime';

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
