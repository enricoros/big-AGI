import { hasGoogleAnalytics, sendGAEvent } from '~/common/components/3rdparty/GoogleAnalytics';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { DLLM, DLLMId, DModelInterfaceV1, LLM_IF_HOTFIX_NoTemperature, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn } from '~/common/stores/llms/llms.types';
import { applyModelParameterSpecsInitialValues, DModelParameterSpecAny, LLMImplicitParamersRuntimeFallback } from '~/common/stores/llms/llms.parameters';
import { isLLMChatPricingFree } from '~/common/stores/llms/llms.pricing';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';

import type { ModelDescriptionSchema } from './server/llm.server.types';
import { findServiceAccessOrThrow } from './vendors/vendor.helpers';


// configuration

/**
 * DO NOT EXPORT TO THE SERVER, as the server knows already but we don't want to cross bundles.
 * When this prefix is used, then the variant ID will not be prefixed with a dash.
 */
export const LLMS_VARIANT_SEPARATOR = '::' as const;

function _clientIdWithVariant(id: string, idVariant?: string): string {
  return !idVariant ? id
    : idVariant.startsWith(LLMS_VARIANT_SEPARATOR) ? `${id}${idVariant}`
      : `${id}-${idVariant}`;
}


// LLM Model Updates Client Functions

export async function llmsUpdateModelsForServiceOrThrow(serviceId: DModelsServiceId, keepUserEdits: true): Promise<{ models: ModelDescriptionSchema[] }> {

  // get the access, assuming there's no client config and the server will do all
  const { service, vendor, transportAccess } = findServiceAccessOrThrow(serviceId);


  // [CSF] Pre-load client-side executor if needed
  let clientSideListModels: typeof import('./llm.client.direct-listModels').clientSideListModels | undefined;
  if (!!transportAccess && typeof transportAccess === 'object' && (transportAccess as any).clientSideFetch)
    try {
      clientSideListModels = (await import('./llm.client.direct-listModels')).clientSideListModels;
    } catch (error) {
      throw new Error(`Direct model listing issue: ${(error as any)?.message || 'unknown loading error'}`, { cause: error });
    }

  // fetch models
  let models: ModelDescriptionSchema[];

  // LLMs [CSM] Direct Execution
  if (clientSideListModels)
    models = await clientSideListModels(transportAccess);

  // LLMs tRPC Execution
  else
    models = (await vendor.rpcUpdateModelsOrThrow(transportAccess)).models;


  // update the global models store
  const factoryLLMs: ReadonlyArray<DLLM> = models.map(
    (model: ModelDescriptionSchema) => _createDLLMFromModelDescription(model, service),
  );
  llmsStoreActions().setServiceLLMs(
    service.id,
    factoryLLMs,
    keepUserEdits,
    false,
  );

  // figure out which vendors are actually used and useful
  hasGoogleAnalytics && sendGAEvent('event', 'app_models_updated', {
    app_models_source_id: service.id,
    app_models_source_label: service.label,
    app_models_updated_count: models.length || 0,
    app_models_vendor_id: vendor.id,
    app_models_vendor_label: vendor.name,
  });

  // return the fetched models
  return { models };
}

const _fallbackInterfaces = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];

function _createDLLMFromModelDescription(d: ModelDescriptionSchema, service: DModelsService): DLLM {

  // null means unknown context/output tokens
  const contextTokens = d.contextWindow || null;
  const maxOutputTokens = d.maxCompletionTokens || (contextTokens ? Math.round(contextTokens / 2) : null); // fallback to half context window

  // initial (user overridable) response tokens setting: equal to the max, if the max is given, or to 1/8th of the context window (when max is set to 1/2 of context)
  const llmResponseTokens = !maxOutputTokens ? null : !d.maxCompletionTokens ? Math.round(maxOutputTokens / 4) : d.maxCompletionTokens;


  // DLLM is a fundamental type in our application
  const dllm: DLLM = {

    // this id is Big-AGI specific, not the vendor's
    id: `${service.id}-${_clientIdWithVariant(d.id, d.idVariant)}`,

    // factory properties
    label: d.label,
    created: d.created || 0,
    updated: d.updated || 0,
    description: d.description,
    hidden: !!d.hidden,

    // hard properties
    contextTokens,
    maxOutputTokens,
    interfaces: d.interfaces?.length ? d.interfaces as DModelInterfaceV1[] : _fallbackInterfaces,
    benchmark: d.benchmark,
    // pricing?: ..., // set below, since it needs some adaptation

    // parameters system (spec and initial values)
    parameterSpecs: d.parameterSpecs?.length
      ? d.parameterSpecs as DModelParameterSpecAny[] // NOTE: our force cast, assume the server (simple zod type) sent valid specs to the client (TS discriminated type)
      : [],
    initialParameters: {
      llmRef: d.id, // CONST - this is the vendor model id
      llmResponseTokens: llmResponseTokens, // number | null
      llmTemperature: // number | null
        d.interfaces.includes(LLM_IF_HOTFIX_NoTemperature) ? null
          : d.initialTemperature !== undefined ? d.initialTemperature
            : LLMImplicitParamersRuntimeFallback.llmTemperature,
    },

    // references
    sId: service.id,
    vId: service.vId,

    // user edited properties: not set
    // userLabel: undefined,
    // userHidden: undefined
    // userStarred: undefined,
    // userContextTokens: undefined,
    // userMaxOutputTokens: undefined,
    // userPricing: undefined,
    // userParameters: undefined,

    // clone metadata
    // isUserClone: false,
    // cloneSourceId: undefined,
  };

  // set the pricing
  if (d.chatPrice && typeof d.chatPrice === 'object')
    dllm.pricing = {
      chat: {
        ...d.chatPrice,
        // compute the free status
        _isFree: isLLMChatPricingFree(d.chatPrice),
      },
    };

  // set other params from spec's initialValues
  if (dllm.parameterSpecs?.length)
    applyModelParameterSpecsInitialValues(dllm.initialParameters, dllm.parameterSpecs, false);

  return dllm;
}


// LLM Clone Creation

/**
 * Creates a clone DLLM object from a source LLM.
 * The clone has its own ID and label but inherits all settings from the source.
 *
 * @param sourceLlm - The source LLM to clone
 * @param cloneLabel - Display label for the clone
 * @param cloneVariant - Variant suffix for the clone ID (will be appended as `-{variant}`)
 * @returns The new DLLM object ready to be added to the store
 */
export function createDLLMUserClone(sourceLlm: DLLM, cloneLabel: string, cloneVariant: string): DLLM {
  const cloneId = getDLLMCloneId(sourceLlm.id, cloneVariant);

  return {
    ...sourceLlm,
    id: cloneId,
    label: cloneLabel,

    // -- Inherited Factory Properties
    // created
    // updated
    // description
    // hidden

    // -- Inherited Hard Properties
    // contextTokens
    // maxOutputTokens
    // interfaces
    // benchmark
    // pricing

    // -- Inherited Parameters
    // parameterSpecs
    // initialParameters

    // references(!)
    // sId
    // vId

    // copy user customizations as the clone's own
    userLabel: undefined, // use the cloneLabel as label directly
    userHidden: sourceLlm.userHidden,
    userStarred: false, // don't auto-star clones
    userContextTokens: sourceLlm.userContextTokens,
    userMaxOutputTokens: sourceLlm.userMaxOutputTokens,
    userPricing: sourceLlm.userPricing ? { ...sourceLlm.userPricing } : undefined,
    userParameters: sourceLlm.userParameters ? { ...sourceLlm.userParameters } : undefined,

    // clone metadata
    isUserClone: true,
    cloneSourceId: sourceLlm.id,
  };
}

/**
 * Generates the clone ID that would be created for a given source and variant.
 * Useful for checking uniqueness before creating a clone.
 */
export function getDLLMCloneId(sourceId: DLLMId, cloneVariant: string): DLLMId {
  return `${sourceId}::${cloneVariant}` as DLLMId;
}
