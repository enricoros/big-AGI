import type React from 'react';

import type { DLLM, DModelSourceId } from '../store-llms';
import { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../transports/chatGenerate';


export type ModelVendorId = 'anthropic' | 'azure' | 'localai' | 'oobabooga' | 'openai' | 'openrouter';


export interface IModelVendor<TSourceSetup = unknown, TLLMOptions = unknown, TAccess = unknown, TDLLM = DLLM<TSourceSetup, TLLMOptions>> {
  readonly id: ModelVendorId;
  readonly name: string;
  readonly rank: number;
  readonly location: 'local' | 'cloud';
  readonly instanceLimit: number;
  readonly hasServerKey?: boolean;

  // components
  readonly Icon: React.ComponentType;
  readonly SourceSetupComponent: React.ComponentType<{ sourceId: DModelSourceId }>;
  readonly LLMOptionsComponent: React.ComponentType<{ llm: TDLLM }>;

  // functions
  readonly initializeSetup?: () => TSourceSetup;

  getAccess(setup?: Partial<TSourceSetup>): TAccess;

  callChatGenerate(llm: TDLLM, messages: VChatMessageIn[], maxTokens?: number): Promise<VChatMessageOut>;

  callChatGenerateWF(llm: TDLLM, messages: VChatMessageIn[], functions: null | VChatFunctionIn[], forceFunctionName: null | string, maxTokens?: number): Promise<VChatMessageOrFunctionCallOut>;
}