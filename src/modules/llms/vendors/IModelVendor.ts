import type React from 'react';

import type { SvgIconProps } from '@mui/joy';

import type { BackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import type { DLLM, DLLMId, DModelSourceId } from '../store-llms';
import type { ModelDescriptionSchema } from '../server/llm.server.types';
import type { ModelVendorId } from './vendors.registry';
import type { StreamingClientUpdate } from './unifiedStreamingClient';
import type { VChatContextRef, VChatFunctionIn, VChatGenerateContextName, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut, VChatStreamContextName } from '../llm.client';


export interface IModelVendor<TSourceSetup = unknown, TAccess = unknown, TLLMOptions = unknown, TDLLM = DLLM<TSourceSetup, TLLMOptions>> {
  readonly id: ModelVendorId;
  readonly name: string;
  readonly rank: number;
  readonly location: 'local' | 'cloud';
  readonly instanceLimit: number;
  readonly hasFreeModels?: boolean;
  readonly hasBackendCapFn?: (backendCapabilities: BackendCapabilities) => boolean; // used to show a 'geen checkmark' in the list of vendors when adding sources
  readonly hasBackendCapKey?: keyof BackendCapabilities;

  // components
  readonly Icon: React.FunctionComponent<SvgIconProps>;
  readonly SourceSetupComponent: React.ComponentType<{ sourceId: DModelSourceId }>;
  readonly LLMOptionsComponent: React.ComponentType<{ llm: TDLLM }>;

  /// abstraction interface ///

  initializeSetup?(): TSourceSetup;

  validateSetup?(setup: TSourceSetup): boolean; // client-side only, accessed via useSourceSetup

  getTransportAccess(setup?: Partial<TSourceSetup>): TAccess;

  getRateLimitDelay?(llm: TDLLM, setup: Partial<TSourceSetup>): number;

  rpcUpdateModelsOrThrow: (
    access: TAccess,
  ) => Promise<{ models: ModelDescriptionSchema[] }>;

  rpcChatGenerateOrThrow: (
    access: TAccess,
    llmOptions: TLLMOptions,
    messages: VChatMessageIn[],
    contextName: VChatGenerateContextName, contextRef: VChatContextRef | null,
    functions: VChatFunctionIn[] | null, forceFunctionName: string | null,
    maxTokens?: number,
  ) => Promise<VChatMessageOut | VChatMessageOrFunctionCallOut>;

  streamingChatGenerateOrThrow: (
    access: TAccess,
    llmId: DLLMId,
    llmOptions: TLLMOptions,
    messages: VChatMessageIn[],
    contextName: VChatStreamContextName, contextRef: VChatContextRef,
    functions: VChatFunctionIn[] | null, forceFunctionName: string | null,
    abortSignal: AbortSignal,
    onUpdate: (update: StreamingClientUpdate, done: boolean) => void,
  ) => Promise<void>;

}
