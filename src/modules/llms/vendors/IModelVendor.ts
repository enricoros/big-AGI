import type React from 'react';
import type { TRPCClientErrorBase } from '@trpc/client';

import type { DLLM, DModelSourceId } from '../store-llms';
import type { ModelDescriptionSchema } from '../server/llm.server.types';
import type { ModelVendorId } from './vendors.registry';
import type { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../client/llm.client.types';


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

  /// abstraction interface ///

  initializeSetup?(): TSourceSetup;

  validateSetup?(setup: TSourceSetup): boolean;

  getTransportAccess(setup?: Partial<TSourceSetup>): TAccess;

  callChatGenerate(llm: TDLLM, messages: VChatMessageIn[], maxTokens?: number): Promise<VChatMessageOut>;

  callChatGenerateWF(llm: TDLLM, messages: VChatMessageIn[], functions: null | VChatFunctionIn[], forceFunctionName: null | string, maxTokens?: number): Promise<VChatMessageOrFunctionCallOut>;
}


export type IModelVendorUpdateModelsQuery<TAccess = unknown> =
  (access: TAccess, enabled: boolean, onSuccess: (data: { models: ModelDescriptionSchema[] }) => void) =>
    { isFetching: boolean, refetch: () => void, isError: boolean, error: TRPCClientErrorBase<any> | null };
