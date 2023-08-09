import type React from 'react';
import type { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from './llm.client';


export type DLLMId = string;
export type DModelSourceId = string;
export type ModelVendorId = 'anthropic' | 'localai' | 'oobabooga' | 'openai' | 'openrouter';


/// Large Language Model - a model that can generate text
export interface DLLM<TLLMOptions = unknown> {
  id: DLLMId;
  label: string;
  created: number | 0;
  description: string;
  tags: string[]; // UNUSED for now
  contextTokens: number;
  hidden: boolean;

  // llm -> source
  sId: DModelSourceId;
  _source: DModelSource;

  // llm-specific
  options: Partial<{ llmRef: string } & TLLMOptions>;
}


/// An origin of models - has enough parameters to list models and invoke generation
export interface DModelSource<TModelSetup = unknown> {
  id: DModelSourceId;
  label: string;

  // source -> vendor
  vId: ModelVendorId;

  // source-specific
  setup: Partial<TModelSetup>;
}


/// Hardcoded vendors - have factory methods to enable dynamic configuration / access
export interface ModelVendor<TSourceSetup = unknown, TLLMOptions = unknown> {
  id: ModelVendorId;
  name: string;
  rank: number;
  location: 'local' | 'cloud';
  instanceLimit: number;

  // components
  Icon: React.ComponentType;
  SourceSetupComponent: React.ComponentType<{ sourceId: DModelSourceId }>;
  LLMOptionsComponent: React.ComponentType<{ llm: DLLM }>;

  // functions
  initalizeSetup?: () => Partial<TSourceSetup>;
  normalizeSetup: (partialSetup?: Partial<TSourceSetup>) => TSourceSetup;
  callChat: (llm: DLLM<TLLMOptions>, messages: VChatMessageIn[], maxTokens?: number) => Promise<VChatMessageOut>;
  callChatWithFunctions: (llm: DLLM<TLLMOptions>, messages: VChatMessageIn[], functions: VChatFunctionIn[], maxTokens?: number) => Promise<VChatMessageOrFunctionCallOut>;
}