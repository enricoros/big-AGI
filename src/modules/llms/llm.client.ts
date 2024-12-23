import { sendGAEvent } from '@next/third-parties/google';

import { hasGoogleAnalytics } from '~/common/components/GoogleAnalytics';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { DLLM, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn } from '~/common/stores/llms/llms.types';
import { FALLBACK_LLM_PARAM_TEMPERATURE } from '~/common/stores/llms/llms.parameters';
import { isModelPricingFree } from '~/common/stores/llms/llms.pricing';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';

import type { ModelDescriptionSchema } from './server/llm.server.types';
import { findServiceAccessOrThrow } from './vendors/vendor.helpers';


// LLM Model Updates Client Functions

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

const _fallbackInterfaces = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];

function _createDLLMFromModelDescription(d: ModelDescriptionSchema, service: DModelsService): DLLM {

  // null means unknown contenxt/output tokens
  const contextTokens = d.contextWindow || null;
  const maxOutputTokens = d.maxCompletionTokens || (contextTokens ? Math.round(contextTokens / 2) : null);
  const llmResponseTokensRatio = d.maxCompletionTokens ? 1 : 1 / 4;
  const llmResponseTokens = maxOutputTokens ? Math.round(maxOutputTokens * llmResponseTokensRatio) : null;

  // create the object
  const dllm: DLLM = {
    id: `${service.id}-${d.id}`,

    // editable properties
    label: d.label,
    created: d.created || 0,
    updated: d.updated || 0,
    description: d.description,
    hidden: !!d.hidden,

    // hard properties
    contextTokens,
    maxOutputTokens,
    trainingDataCutoff: d.trainingDataCutoff,
    interfaces: d.interfaces?.length ? d.interfaces : _fallbackInterfaces,
    benchmark: d.benchmark,
    // pricing: undefined, // set below, since it needs some adaptation

    // parameters system (spec and initial values)
    parameterSpecs: d.parameterSpecs?.length ? d.parameterSpecs : [],
    initialParameters: {
      llmRef: d.id,
      llmTemperature: FALLBACK_LLM_PARAM_TEMPERATURE,
      llmResponseTokens: llmResponseTokens,
    },

    // references
    sId: service.id,
    vId: service.vId,

    // user edited properties: not set
    // userLabel: undefined,
    // userHidden: undefined,
    // userParameters: undefined,
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
