import type React from 'react';

import type { DLLM, DModelSourceId } from '../store-llms';
import { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../transports/chatGenerate';


export type ModelVendorId = 'anthropic' | 'azure' | 'localai' | 'ollama' | 'oobabooga' | 'openai' | 'openrouter';


export interface IModelVendor<TSourceSetup = unknown, TAccess = unknown, TLLMOptions = unknown, TDLLM = DLLM<TSourceSetup, TLLMOptions>> {
  readonly id: ModelVendorId;
  readonly name: string;
  readonly rank: number;
  readonly location: 'local' | 'cloud';
  readonly instanceLimit: number;
  readonly hasFreeModels?: boolean;
  readonly hasBackendCap?: () => boolean;

  // components
  readonly Icon: React.ComponentType | string;
  readonly SourceSetupComponent: React.ComponentType<{ sourceId: DModelSourceId }>;
  readonly LLMOptionsComponent: React.ComponentType<{ llm: TDLLM }>;

  // functions
  readonly initializeSetup?: () => TSourceSetup;

  // get a TAccess object, translating from TSourceSetup
  getTransportAccess(setup?: Partial<TSourceSetup>): TAccess;

  callChatGenerate(llm: TDLLM, messages: VChatMessageIn[], maxTokens?: number): Promise<VChatMessageOut>;

  callChatGenerateWF(llm: TDLLM, messages: VChatMessageIn[], functions: null | VChatFunctionIn[], forceFunctionName: null | string, maxTokens?: number): Promise<VChatMessageOrFunctionCallOut>;
}