import type React from 'react';

import type { SvgIconProps } from '@mui/joy';

import type { BackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import type { DLLM, DLLMId } from '~/common/stores/llms/llms.types';
import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';

import type { ModelDescriptionSchema } from '../server/llm.server.types';
import type { ModelVendorId } from './vendors.registry';
import type { StreamingClientUpdate } from './unifiedStreamingClient';
import type { VChatContextRef, VChatFunctionIn, VChatGenerateContextName, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut, VChatStreamContextName } from '../llm.client';


export interface IModelVendor<TServiceSettings = unknown, TAccess = unknown, TLLMOptions = unknown, TDLLM = DLLM<TLLMOptions>> {
  readonly id: ModelVendorId;
  readonly name: string;
  readonly rank: number;
  readonly location: 'local' | 'cloud';
  readonly brandColor?: string;
  readonly instanceLimit?: number;
  readonly hasFreeModels?: boolean;
  readonly hasBackendCapFn?: (backendCapabilities: BackendCapabilities) => boolean; // used to show a 'green checkmark' in the list of vendors when adding services
  readonly hasBackendCapKey?: keyof BackendCapabilities;

  // components
  readonly Icon: React.FunctionComponent<SvgIconProps>;
  readonly ServiceSetupComponent: React.ComponentType<{ serviceId: DModelsServiceId }>;
  readonly LLMOptionsComponent: React.ComponentType<{ llm: TDLLM }>;

  /// abstraction interface ///

  initializeSetup?(): TServiceSettings;

  validateSetup?(setup: TServiceSettings): boolean; // client-side only, accessed via useServiceSetup

  getTransportAccess(setup?: Partial<TServiceSettings>): TAccess;

  rateLimitChatGenerate?(llm: TDLLM, setup: Partial<TServiceSettings>): Promise<void>;

  rpcUpdateModelsOrThrow(
    access: TAccess,
  ): Promise<{ models: ModelDescriptionSchema[] }>;

  rpcChatGenerateOrThrow(
    access: TAccess,
    llmOptions: TLLMOptions,
    messages: VChatMessageIn[],
    contextName: VChatGenerateContextName, contextRef: VChatContextRef | null,
    functions: VChatFunctionIn[] | null, forceFunctionName: string | null,
    maxTokens?: number,
  ): Promise<VChatMessageOut | VChatMessageOrFunctionCallOut>;

  streamingChatGenerateOrThrow(
    access: TAccess,
    llmId: DLLMId,
    llmOptions: TLLMOptions,
    messages: VChatMessageIn[],
    contextName: VChatStreamContextName, contextRef: VChatContextRef,
    functions: VChatFunctionIn[] | null, forceFunctionName: string | null,
    abortSignal: AbortSignal,
    onUpdate: (update: StreamingClientUpdate, done: boolean) => void,
  ): Promise<void>;

}
