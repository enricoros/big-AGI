import { sendGAEvent } from '@next/third-parties/google';

import { hasGoogleAnalytics } from '~/common/components/GoogleAnalytics';

import type { OpenAIWire_Tools } from '~/modules/aix/server/dispatch/wiretypes/openai.wiretypes';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { DLLM, DLLMId, LLM_IF_OAI_Chat } from '~/common/stores/llms/llms.types';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { isModelPricingFree } from '~/common/stores/llms/llms.pricing';

import type { ModelDescriptionSchema } from './server/llm.server.types';
import { DOpenAILLMOptions, FALLBACK_LLM_TEMPERATURE } from './vendors/openai/openai.vendor';
import { findServiceAccessOrThrow } from './vendors/vendor.helpers';


// LLM Client Types
// NOTE: Model List types in '../server/llm.server.types';

export interface VChatMessageIn {
  role: 'assistant' | 'system' | 'user'; // | 'function';
  content: string;
  //name?: string; // when role: 'function'
}

export type VChatFunctionIn = OpenAIWire_Tools.FunctionDefinition;

export interface VChatMessageOut {
  role: 'assistant' | 'system' | 'user';
  content: string;
  finish_reason: 'stop' | 'length' | null;
}

export interface VChatMessageOrFunctionCallOut extends VChatMessageOut {
  function_name: string;
  function_arguments: object | null;
}


// LLM Client Functions

export async function llmsUpdateModelsForServiceOrThrow(serviceId: DModelsServiceId, keepUserEdits: boolean): Promise<{ models: ModelDescriptionSchema[] }> {

  // get the access, assuming there's no client config and the server will do all
  const { service, vendor, transportAccess } = findServiceAccessOrThrow(serviceId);

  // fetch models
  const data = await vendor.rpcUpdateModelsOrThrow(transportAccess);

  // update the global models store
  llmsStoreActions().setLLMs(
    data.models.map(model => _createDLLMFromModelDescription(model, service)),
    service.id,
    true,
    keepUserEdits,
  );

  // figure out which vendors are actually used and useful
  hasGoogleAnalytics && sendGAEvent('event', 'app_models_updated', {
    app_models_source_id: service.id,
    app_models_source_label: service.label,
    app_models_updated_count: data.models.length || 0,
    app_models_vendor_id: vendor.id,
    app_models_vendor_label: vendor.name,
  });

  // return the fetched models
  return data;
}

function _createDLLMFromModelDescription(d: ModelDescriptionSchema, service: DModelsService): DLLM<DOpenAILLMOptions> {

  // null means unknown contenxt/output tokens
  const contextTokens = d.contextWindow || null;
  const maxOutputTokens = d.maxCompletionTokens || (contextTokens ? Math.round(contextTokens / 2) : null);
  const llmResponseTokensRatio = d.maxCompletionTokens ? 1 : 1 / 4;
  const llmResponseTokens = maxOutputTokens ? Math.round(maxOutputTokens * llmResponseTokensRatio) : null;

  // create the object
  const dllm: DLLM<DOpenAILLMOptions> = {
    id: `${service.id}-${d.id}`,

    // editable properties
    label: d.label,
    created: d.created || 0,
    updated: d.updated || 0,
    description: d.description,
    hidden: !!d.hidden,
    // isEdited: false, // NOTE: this is set by the store on user edits

    // hard properties
    contextTokens,
    maxOutputTokens,
    trainingDataCutoff: d.trainingDataCutoff,
    interfaces: d.interfaces?.length ? d.interfaces : [LLM_IF_OAI_Chat],
    // inputTypes: ...
    benchmark: d.benchmark,
    // pricing: undefined,

    // references
    sId: service.id,
    vId: service.vId,

    // llm-specific
    options: {
      llmRef: d.id,
      // @ts-ignore FIXME: large assumption that this is LLMOptionsOpenAI object
      llmTemperature: FALLBACK_LLM_TEMPERATURE,
      llmResponseTokens,
    },
  };

  // set the pricing
  if (d.chatPrice && typeof d.chatPrice === 'object') {
    dllm.pricing = {
      chat: {
        ...d.chatPrice,
        // compute the free status
        _isFree: isModelPricingFree(d.chatPrice),
      },
    };
  }

  return dllm;
}


export async function llmStreamingChatGenerate<
  TServiceSettings extends object = {},
  TAccess = undefined,
  TLLMOptions = unknown
>(
  llmId: DLLMId,
  messages: VChatMessageIn[],
  contextName: string,
  contextRef: string | null,
  functions: VChatFunctionIn[] | null,
  forceFunctionName: string | null,
  abortSignal: AbortSignal,
  onUpdate: (update: any, done: boolean) => void,
): Promise<void> {
  throw new Error(`llmStreamingChatGenerate: ${contextName} not migrated to AIX yet.`);
}
