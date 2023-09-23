import type React from 'react';

import type { DLLM, DModelSourceId } from '../store-llms';
import { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../transports/chatGenerate';


export type ModelVendorId = 'anthropic' | 'azure' | 'localai' | 'oobabooga' | 'openai' | 'openrouter';


export interface IModelVendor<TSourceSetup = unknown, TLLMOptions = unknown> {
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
  initializeSetup?: () => TSourceSetup;
  normalizeSetup: (partialSetup?: Partial<TSourceSetup>) => TSourceSetup;
  callChat: (llm: DLLM<TLLMOptions>, messages: VChatMessageIn[], maxTokens?: number) => Promise<VChatMessageOut>;
  callChatWithFunctions: (llm: DLLM<TLLMOptions>, messages: VChatMessageIn[], functions: VChatFunctionIn[], forceFunctionName?: string, maxTokens?: number) => Promise<VChatMessageOrFunctionCallOut>;
}