//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DOpenRouterServiceSettings } from '~/modules/llms/vendors/openrouter/openrouter.vendor';
import type { IModelVendor } from '~/modules/llms/vendors/IModelVendor';
import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DModelDomainId } from './model.domains.types';
import type { DModelParameterId, DModelParameterValues } from './llms.parameters';
import type { DModelsService, DModelsServiceId } from './llms.service.types';
import { DLLM, DLLMId, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from './llms.types';
import { createDModelConfiguration, DModelConfiguration } from './modelconfiguration.types';
import { createLlmsAssignmentsSlice, LlmsAssignmentsActions, LlmsAssignmentsSlice, LlmsAssignmentsState, llmsHeuristicUpdateAssignments } from './store-llms-domains_slice';
import { getDomainModelConfiguration } from './hooks/useModelDomain';
import { portModelPricingV2toV3 } from './llms.pricing';


/// ModelsStore - a store for configured LLMs and configured services

export interface LlmsRootState {

  llms: DLLM[];

  sources: DModelsService<any>[];

  confServiceId: DModelsServiceId | null;

}

interface LlmsRootActions {

  setServiceLLMs: (serviceId: DModelsServiceId, serviceLLMs: ReadonlyArray<DLLM>, keepUserEdits: boolean, keepMissingLLMs: boolean) => void;
  removeLLM: (id: DLLMId) => void;
  rerankLLMsByServices: (serviceIdOrder: DModelsServiceId[]) => void;
  updateLLM: (id: DLLMId, partial: Partial<DLLM>) => void;
  updateLLMUserParameters: (id: DLLMId, partial: Partial<DModelParameterValues>) => void;
  deleteLLMUserParameter: (id: DLLMId, parameterId: DModelParameterId) => void;

  createModelsService: (vendor: IModelVendor) => DModelsService;
  removeService: (id: DModelsServiceId) => void;
  updateServiceSettings: <TServiceSettings>(id: DModelsServiceId, partialSettings: Partial<TServiceSettings>) => void;

  setConfServiceId: (id: DModelsServiceId | null) => void;

  // special
  setOpenRouterKey: (key: string) => void;

}


type LlmsRootSlice = LlmsRootState & LlmsRootActions;
type LlmsStore = LlmsRootSlice & LlmsAssignmentsSlice;


export const useModelsStore = create<LlmsStore>()(persist(
  (set, get, _store) => ({

    // include slices
    ...createLlmsAssignmentsSlice(set, get, _store),

    // initial state

    llms: [],
    sources: [],
    confServiceId: null,

    // actions

    setServiceLLMs: (serviceId: DModelsServiceId, serviceLLMs: ReadonlyArray<DLLM>, keepUserEdits: boolean, keepMissingLLMs: boolean) =>
      set(({ llms: existingLLMs, modelAssignments }) => {

        // keep existing model customizations
        if (keepUserEdits) {
          serviceLLMs = serviceLLMs.map((llm: DLLM): DLLM => {
            const existing = existingLLMs.find(m => m.id === llm.id);
            return !existing ? llm : {
              ...llm,
              ...(existing.userLabel !== undefined ? { userLabel: existing.userLabel } : {}),
              ...(existing.userHidden !== undefined ? { userHidden: existing.userHidden } : {}),
              ...(existing.userParameters !== undefined ? { userParameters: { ...existing.userParameters } } : {}),
            };
          });
        }

        // remove models that are not in the new list
        if (!keepMissingLLMs)
          existingLLMs = existingLLMs.filter(llm => llm.sId !== serviceId);

        // replace existing llms with the same id
        const newLlms = [...serviceLLMs, ...existingLLMs.filter(existingLlm => !serviceLLMs.some(newLlm => newLlm.id === existingLlm.id))];
        return {
          llms: newLlms,
          modelAssignments: llmsHeuristicUpdateAssignments(newLlms, modelAssignments),
        };
      }),

    removeLLM: (id: DLLMId) =>
      set(state => {
        const newLlms = state.llms.filter(llm => llm.id !== id);
        return {
          llms: newLlms,
          modelAssignments: llmsHeuristicUpdateAssignments(newLlms, state.modelAssignments),
        };
      }),

    rerankLLMsByServices: (serviceIdOrder: DModelsServiceId[]) =>
      set(state => {
        // Create a mapping of service IDs to their index in the provided order
        const serviceIdToIndex = serviceIdOrder.reduce((acc, sId, idx) => {
          acc[sId] = idx;
          return acc;
        }, {} as Record<DModelsServiceId, number>);

        // Sort the LLMs based on the order of their service IDs
        const orderedLlms = [...state.llms].sort((a, b) => {
          const aIndex = serviceIdToIndex[a.sId] ?? Number.MAX_SAFE_INTEGER;
          const bIndex = serviceIdToIndex[b.sId] ?? Number.MAX_SAFE_INTEGER;
          return aIndex - bIndex;
        });

        return {
          llms: orderedLlms,
        };
      }),

    updateLLM: (id: DLLMId, partial: Partial<DLLM>) =>
      set(state => ({
        llms: state.llms.map((llm: DLLM): DLLM =>
          llm.id === id
            ? { ...llm, ...partial }
            : llm,
        ),
      })),

    updateLLMUserParameters: (id: DLLMId, partialUserParameters: Partial<DModelParameterValues>) =>
      set(({ llms }) => ({
        llms: llms.map((llm: DLLM): DLLM =>
          llm.id === id
            ? { ...llm, userParameters: { ...llm.userParameters, ...partialUserParameters } }
            : llm,
        ),
      })),

    deleteLLMUserParameter: (id: DLLMId, parameterId: DModelParameterId) =>
      set(({ llms }) => ({
        llms: llms.map((llm: DLLM): DLLM =>
          llm.id === id && llm.userParameters
            ? { ...llm, userParameters: Object.fromEntries(Object.entries(llm.userParameters).filter(([key]) => key !== parameterId)) }
            : llm,
        ),
      })),

    createModelsService: (vendor: IModelVendor): DModelsService => {

      function _locallyUniqueServiceId(vendorId: ModelVendorId, existingServices: DModelsService[]): DModelsServiceId {
        let serviceId: DModelsServiceId = vendorId;
        let serviceIdx = 0;
        while (existingServices.find(s => s.id === serviceId)) {
          serviceIdx++;
          serviceId = `${vendorId}-${serviceIdx}`;
        }
        return serviceId;
      }

      function _relabelServicesFromSameVendor(vendorId: ModelVendorId, services: DModelsService[]): DModelsService[] {
        let n = 0;
        return services.map((s: DModelsService): DModelsService =>
          (s.vId !== vendorId) ? s
            : { ...s, label: s.label.replace(/ #\d+$/, '') + (++n > 1 ? ` #${n}` : '') },
        );
      }

      const { sources: existingServices, confServiceId } = get();

      // create the service
      const newService: DModelsService = {
        id: _locallyUniqueServiceId(vendor.id, existingServices),
        label: vendor.name,
        vId: vendor.id,
        setup: vendor.initializeSetup?.() || {},
      };

      const newServices = _relabelServicesFromSameVendor(vendor.id, [...existingServices, newService]);

      set({
        sources: newServices,
        confServiceId: confServiceId ?? newService.id,
      });

      return newServices[newServices.length - 1];
    },

    removeService: (id: DModelsServiceId) =>
      set(state => {
        const llms = state.llms.filter(llm => llm.sId !== id);
        return {
          llms,
          sources: state.sources.filter(s => s.id !== id),
          modelAssignments: llmsHeuristicUpdateAssignments(llms, state.modelAssignments),
        };
      }),

    updateServiceSettings: <TServiceSettings>(id: DModelsServiceId, partialSettings: Partial<TServiceSettings>) =>
      set(state => ({
        sources: state.sources.map((s: DModelsService): DModelsService =>
          s.id === id
            ? { ...s, setup: { ...s.setup, ...partialSettings } }
            : s,
        ),
      })),

    setConfServiceId: (id: DModelsServiceId | null) =>
      set({ confServiceId: id }),

    setOpenRouterKey: (key: string) =>
      set(state => {
        const firstOpenRouterService = state.sources.find(s => s.vId === 'openrouter');
        return !firstOpenRouterService ? state : {
          sources: state.sources.map((s: DModelsService): DModelsService =>
            s.id === firstOpenRouterService.id
              ? { ...s, setup: { ...s.setup, oaiKey: key satisfies DOpenRouterServiceSettings['oaiKey'] } }
              : s,
          ),
        };
      }),

  }),
  {
    name: 'app-models',

    /* versioning:
     *  1: adds maxOutputTokens (default to half of contextTokens)
     *  2: large changes on all LLMs, and reset chat/fast/func LLMs
     *  3: big-AGI v2
     *  4: migrate .options to .initialParameters/.userParameters
     *  4B: we changed from .chatLLMId/.fastLLMId to modelAssignments: {}, without expicit migration (done on rehydrate, and for no particular reason)
     */
    version: 4,
    migrate: (_state: any, fromVersion: number): LlmsStore => {

      if (!_state) return _state;
      const state: LlmsStore = _state;

      // 0 -> 1: add 'maxOutputTokens' where missing
      if (fromVersion < 1)
        for (const llm of state.llms)
          if (llm.maxOutputTokens === undefined)
            llm.maxOutputTokens = llm.contextTokens ? Math.round(llm.contextTokens / 2) : null;

      // 1 -> 2: large changes
      if (fromVersion < 2) {
        for (const llm of state.llms) {
          delete (llm as any)['tags'];
          llm.interfaces = ['oai-chat' /* this is here like this to reduce dependencies */];
          // llm.inputTypes = { 'text': {} };
        }
      }

      // 2 -> 3: big-AGI v2: update all models for pricing info
      if (fromVersion < 3) {
        try {
          state.llms.forEach(portModelPricingV2toV3);
        } catch (error) {
          // ... if there's any error, ignore - shall be okay
        }
      }

      // 3 -> 4: migrate .options to .initialParameters/.userParameters
      if (fromVersion < 4) {
        try {
          state.llms.forEach(_port_V3Options_to_V4Parameters_inline);
        } catch (error) {
          // ... if there's any error, ignore - shall be okay
        }
      }

      return state;
    },

    // Pre-saving: omit the memory references from the persisted state
    // partialize: (state) => ({
    //   ...state,
    //   llms: state.llms.map((llm: DLLM): Omit<DLLM, 'itemToRemove'> => {
    //     const { itemToRemove, ...rest } = llm;
    //     return rest;
    //   }),
    // }),

    // Post-loading: ensure a valid starting state
    onRehydrateStorage: () => (state) => {
      if (!state) return;

      // [GC] remove models that do not refer to a valid service
      state.llms = state.llms.map((llm: DLLM): DLLM | null => {
        // finds the service that provides the model
        const service = state.sources.find(s => s.id === llm.sId);
        if (!service || !service.vId) return null;

        // ensure the vId link exists and is valid (this was a pre-TF update)
        return llm.vId ? llm : { ...llm, vId: service.vId };
      }).filter(llm => !!llm) as DLLM[];

      // Select the best LLMs automatically, if not set
      try {
        //  auto-detect assignments, or re-import them from the old format
        if (!state.modelAssignments || !Object.keys(state.modelAssignments).length) {

          // reimport the former chatLLMId and fastLLMId if set
          const prevState = state as { chatLLMId?: DLLMId, fastLLMId?: DLLMId };
          const existingAssignments: Partial<Record<DModelDomainId, DModelConfiguration>> = {};
          if (prevState.chatLLMId) {
            existingAssignments['primaryChat'] = createDModelConfiguration('primaryChat', prevState.chatLLMId);
            existingAssignments['codeApply'] = createDModelConfiguration('codeApply', prevState.chatLLMId);
            delete prevState.chatLLMId;
          }
          if (prevState.fastLLMId) {
            existingAssignments['fastUtil'] = createDModelConfiguration('fastUtil', prevState.fastLLMId);
            delete prevState.fastLLMId;
          }

          // auto-pick models
          state.modelAssignments = llmsHeuristicUpdateAssignments(state.llms, existingAssignments);
        }
      } catch (error) {
        console.error('Error in autoPickModels', error);
      }
    },

  },
));


export function findLLMOrThrow(llmId: DLLMId): DLLM {
  const llm: DLLM | undefined = llmsStoreState().llms.find(llm => llm.id === llmId);
  if (!llm)
    throw new Error(`Large Language Model ${llmId} not found`);
  return llm;
}

export function findModelsServiceOrNull<TServiceSettings extends object>(serviceId: DModelsServiceId): DModelsService<TServiceSettings> | null {
  return llmsStoreState().sources.find(s => s.id === serviceId) ?? null;
}

export function getChatLLMId(): DLLMId | null {
  return getDomainModelConfiguration('primaryChat', true, true)?.modelId ?? null;
}


export function getDomainModelIdOrThrow(tryDomains: DModelDomainId[], requireFunctionCallTools: boolean, requireImageInput: boolean, useCaseLabel: string): DLLMId {
  for (const domain of tryDomains) {
    const isLastTry = domain === tryDomains[tryDomains.length - 1];
    const llmId = getDomainModelConfiguration(domain, true, true)?.modelId;
    if (!llmId) continue;
    try {
      const llm = findLLMOrThrow(llmId);
      if (requireFunctionCallTools && !llm.interfaces.includes(LLM_IF_OAI_Fn)) {
        if (isLastTry) console.log(`[llm selection] Accepting ${llmId} for '${useCaseLabel}' despite missing function call tools.`);
        else continue;
      }
      if (requireImageInput && !llm.interfaces.includes(LLM_IF_OAI_Vision)) {
        if (isLastTry) console.log(`[llm selection] Accepting ${llmId} for '${useCaseLabel}' despite missing image input.`);
        else continue;
      }
      return llmId;
    } catch (error) {
      // Try next or fall back to the error
    }
  }
  throw new Error(`No model available for '${useCaseLabel}'. Pease select a '${tryDomains[0]}' model that supports${requireFunctionCallTools ? ' function calls' : ' text input'}${requireImageInput ? ' and image input' : ''} in App Preferences > Chat AI.`);
}


export function llmsStoreState(): LlmsRootState & LlmsAssignmentsState {
  return useModelsStore.getState();
}

export function llmsStoreActions(): LlmsRootActions & LlmsAssignmentsActions {
  return useModelsStore.getState();
}

export function getLLMsDebugInfo() {
  const { llms, sources, modelAssignments } = llmsStoreState();
  return { services: sources.length, llmsCount: llms.length, modelAssignments };
}

function _port_V3Options_to_V4Parameters_inline(llm: DLLM): void {

  // skip if already migrated
  if ('initialParameters' in (llm as object)) return;

  // initialize initialParameters and userParameters if they don't exist
  if (!llm.initialParameters) llm.initialParameters = {};
  if (!llm.userParameters) llm.userParameters = {};

  // migrate options to initialParameters/userParameters
  type DLLMV3_Options = DLLM & { options?: { llmRef: string, llmTemperature?: number, llmResponseTokens?: number } & Record<string, any> };
  const llmV3 = llm as DLLMV3_Options;
  if ('options' in llmV3 && typeof llmV3.options === 'object') {
    if ('llmRef' in llmV3.options)
      llm.initialParameters.llmRef = llmV3.options.llmRef;
    if ('llmTemperature' in llmV3.options && typeof llmV3.options.llmTemperature === 'number')
      llm.initialParameters.llmTemperature = Math.max(0, Math.min(1, llmV3.options.llmTemperature));
    if ('llmResponseTokens' in llmV3.options && typeof llmV3.options.llmResponseTokens === 'number')
      llm.initialParameters.llmResponseTokens = llmV3.options.llmResponseTokens;
    delete llmV3.options;
  }

}