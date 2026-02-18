//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DOpenRouterServiceSettings } from '~/modules/llms/vendors/openrouter/openrouter.vendor';
import type { IModelVendor } from '~/modules/llms/vendors/IModelVendor';
import { createDLLMUserClone, getDLLMCloneId } from '~/modules/llms/llm.client';
import { findModelVendor, type ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import { hasKeys } from '~/common/util/objectUtils';

import type { DModelDomainId } from './model.domains.types';
import type { DModelsService, DModelsServiceId } from './llms.service.types';
import { DLLM, DLLMId, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from './llms.types';
import { DModelParameterId, DModelParameterRegistry, DModelParameterValues, LLMImplicitParamersRuntimeFallback } from './llms.parameters';
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

  setServiceLLMs: (serviceId: DModelsServiceId, serviceLLMs: ReadonlyArray<DLLM>, keepUserEdits: true, keepMissingLLMs: false) => void;
  removeLLM: (id: DLLMId) => void;
  removeCustomModels: (serviceId: DModelsServiceId) => void;
  rerankLLMsByServices: (serviceIdOrder: DModelsServiceId[]) => void;
  updateLLM: (id: DLLMId, partial: Partial<DLLM>) => void;
  updateLLMs: (updates: Array<{ id: DLLMId; partial: Partial<DLLM> }>) => void;
  updateLLMUserParameters: (id: DLLMId, partial: Partial<DModelParameterValues>) => void;
  deleteLLMUserParameter: (id: DLLMId, parameterId: DModelParameterId) => void;
  resetLLMUserParameters: (id: DLLMId) => void;
  resetServiceUserParameters: (serviceId: DModelsServiceId) => void;
  resetServiceVisibility: (serviceId: DModelsServiceId) => void;
  setServiceModelsHidden: (serviceId: DModelsServiceId, hidden: boolean) => void;
  userCloneLLM: (sourceId: DLLMId, cloneLabel: string, cloneVariant: string) => DLLMId | null;

  createModelsService: (vendor: IModelVendor) => DModelsService;
  removeService: (id: DModelsServiceId) => void;
  updateServiceLabel: (id: DModelsServiceId, label: string, allowEmpty?: boolean) => void;
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

    setServiceLLMs: (serviceId: DModelsServiceId, updatedServiceLLMs: ReadonlyArray<DLLM>, keepUserEdits: true, keepMissingLLMs: false) =>
      set(({ llms, modelAssignments }) => {

        // separate existing models
        const otherServiceLLMs = llms.filter(llm => llm.sId !== serviceId);
        const previousServiceLLMs = llms.filter(llm => llm.sId === serviceId);
        const consumedPreviousIds = new Set<DLLMId>();

        // process updated models, re-applying user customizations where applicable
        const mergedServiceLLMs: DLLM[] = updatedServiceLLMs.map((llm: DLLM): DLLM => {
          // new model: as-is
          const e = previousServiceLLMs.find(m => m.id === llm.id);
          if (!e) return llm;

          // mark this previous model as matched (consumed)
          consumedPreviousIds.add(e.id);

          // re-apply user edits from existing model to the new model data
          if (!keepUserEdits) return llm;
          const result: DLLM = {
            ...llm,
            ...(e.userLabel !== undefined ? { userLabel: e.userLabel } : {}),
            ...(e.userHidden !== undefined ? { userHidden: e.userHidden } : {}),
            ...(e.userStarred !== undefined ? { userStarred: e.userStarred } : {}),
            ...(e.userContextTokens !== undefined ? { userContextTokens: e.userContextTokens } : {}),
            ...(e.userMaxOutputTokens !== undefined ? { userMaxOutputTokens: e.userMaxOutputTokens } : {}),
            ...(e.userPricing !== undefined ? { userPricing: e.userPricing } : {}),
            ...(e.userParameters !== undefined ? { userParameters: { ...e.userParameters } } : {}),
          };

          // clean up stale parameters from userParameters -
          // - e.g. was in the model spec but removed in the new version
          // - or the value of an enum got removed, and so we remove ours
          if (result.userParameters) {
            for (const key of Object.keys(result.userParameters)) {
              const paramId = key as DModelParameterId;

              // keep implicit common parameters (always supported, not in parameterSpecs)
              if (paramId in LLMImplicitParamersRuntimeFallback)
                continue;

              // remove parameters no longer in spec
              const paramSpec = llm.parameterSpecs.find(spec => spec.paramId === paramId);
              if (!paramSpec) {
                delete result.userParameters[paramId];
                continue;
              }

              // for enum types, validate the value is still in the allowed values
              const regDef = DModelParameterRegistry[paramId];
              if (regDef && regDef.type === 'enum' && 'values' in regDef && Array.isArray(regDef.values)) {
                const currentValue = result.userParameters[paramId];
                if (currentValue && typeof currentValue === 'string') {
                  // reset to default - parameter definition does not contain this value anymore
                  if (!(regDef.values as ReadonlyArray<string>).includes(currentValue)) {
                    delete result.userParameters[paramId];
                    console.log(`[DEV] Resetting '${paramId}' for '${llm.id}' because '${currentValue}' is no longer supported.`);
                  }
                  // reset to default - model parameter spec does not allow this value anymore
                  else if (paramSpec.enumValues?.length && !paramSpec.enumValues.includes(currentValue)) {
                    delete result.userParameters[paramId];
                    console.log(`[DEV] Resetting '${paramId}' for '${llm.id}' because '${currentValue}' is no longer allowed for the model.`);
                  }
                }
              }

              // NOTE: no range validation for integer/float types yet. If added, be aware that
              // llmVndAntThinkingBudget uses initialValue: -1 (out of range [1024, 65536]) as a
              // sentinel for adaptive thinking mode on hidden params - range checks must skip hidden params.
            }
          }

          return result;
        });


        // Always preserve custom models
        // - NOTE: shall we check for the undelying ref to still be in the service, to auto-clean-up older models?
        const customModels = previousServiceLLMs.filter(llm => llm.isUserClone === true && !consumedPreviousIds.has(llm.id));
        const missingModels = !keepMissingLLMs ? [] : previousServiceLLMs.filter(llm => !llm.isUserClone && !consumedPreviousIds.has(llm.id));

        // Build the final list in priority order
        const newLlms = [...customModels, ...missingModels, ...mergedServiceLLMs, ...otherServiceLLMs];
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

    removeCustomModels: (serviceId: DModelsServiceId) =>
      set(state => {
        const newLlms = state.llms.filter(llm => !(llm.sId === serviceId && llm.isUserClone === true));
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

    updateLLMs: (updates: Array<{ id: DLLMId; partial: Partial<DLLM> }>) =>
      set(state => {
        // Create a map of updates for efficient lookup
        const updatesMap = new Map(updates.map(u => [u.id, u.partial]));

        return {
          llms: state.llms.map((llm: DLLM): DLLM => {
            const partial = updatesMap.get(llm.id);
            return partial ? { ...llm, ...partial } : llm;
          }),
        };
      }),

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

    resetLLMUserParameters: (id: DLLMId) =>
      set(({ llms }) => ({
        llms: llms.map((llm: DLLM): DLLM => {
          if (llm.id !== id) return llm;
          // strip away user parameters and user label
          const {
            userParameters,
            // userLabel, // not resetting the name for now
            // userContextTokens, userMaxOutputTokens, userPricing, ...
            ...rest
          } = llm;
          return rest;
        }),
      })),

    resetServiceUserParameters: (serviceId: DModelsServiceId) =>
      set(({ llms }) => ({
        llms: llms.map((llm: DLLM): DLLM => {
          if (llm.sId !== serviceId) return llm;
          // strip away user parameters and user label
          const {
            userParameters,
            userLabel, // service-wide reset includes resetting the name
            // userContextTokens, userMaxOutputTokens, userPricing, ...
            ...rest
          } = llm;
          return rest;
        }),
      })),

    resetServiceVisibility: (serviceId: DModelsServiceId) =>
      set(({ llms }) => ({
        llms: llms.map((llm: DLLM): DLLM => {
          if (llm.sId !== serviceId) return llm;
          const { userHidden, ...rest } = llm;
          return rest;
        }),
      })),

    setServiceModelsHidden: (serviceId: DModelsServiceId, hidden: boolean) =>
      set(({ llms }) => ({
        llms: llms.map((llm: DLLM): DLLM =>
          llm.sId === serviceId
            ? { ...llm, userHidden: hidden }
            : llm,
        ),
      })),

    userCloneLLM: (sourceId: DLLMId, cloneLabel: string, cloneVariant: string): DLLMId | null => {
      const { llms } = get();
      const sourceLlm = llms.find(llm => llm.id === sourceId);
      if (!sourceLlm) return null;

      // check uniqueness
      const cloneId = getDLLMCloneId(sourceId, cloneVariant);
      if (llms.some(llm => llm.id === cloneId)) return null;

      // create clone
      const cloneLlm = createDLLMUserClone(sourceLlm, cloneLabel, cloneVariant);

      // IMPORTANT: we have to have this LLM be part of the same group (or the UI will break on multiple-grouping)
      const serviceStartIndex = llms.findIndex(llm => llm.sId === sourceLlm.sId);
      const newLlms = [...llms];
      newLlms.splice(serviceStartIndex, 0, cloneLlm);
      set({ llms: newLlms });

      return cloneId;
    },

    createModelsService: (vendor: IModelVendor): DModelsService => {

      // e.g. 'openai', 'openai-1', 'openai-2' - finds the first available slot
      function _locallyUniqueServiceId(vendorId: ModelVendorId, existingServices: DModelsService[]): DModelsServiceId {
        let serviceId: DModelsServiceId = vendorId;
        let serviceIdx = 0;
        while (existingServices.find(s => s.id === serviceId)) {
          serviceIdx++;
          serviceId = `${vendorId}-${serviceIdx}`;
        }
        return serviceId;
      }

      // e.g. 'OpenAI', 'OpenAI #2', 'OpenAI #3' - uses max index + 1, never relabels existing
      function _nextAutoLabelForVendor(vendorId: ModelVendorId, vendorName: string, existingServices: DModelsService[]): string {
        const sameVendorServices = existingServices.filter(s => s.vId === vendorId);
        if (sameVendorServices.length === 0)
          return vendorName;
        let maxIndex = 1;
        for (const s of sameVendorServices) {
          const match = s.label.match(/ #(\d+)$/);
          if (match)
            maxIndex = Math.max(maxIndex, parseInt(match[1], 10));
        }
        return `${vendorName} #${maxIndex + 1}`;
      }

      const { sources: existingServices, confServiceId } = get();

      const newService: DModelsService = {
        id: _locallyUniqueServiceId(vendor.id, existingServices),
        label: _nextAutoLabelForVendor(vendor.id, vendor.name, existingServices),
        vId: vendor.id,
        setup: vendor.initializeSetup?.() || {},
      };

      set({
        sources: [...existingServices, newService],
        confServiceId: confServiceId ?? newService.id,
      });

      return newService;
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

    updateServiceLabel: (id: DModelsServiceId, label: string, allowEmpty: boolean = false) =>
      set(state => {
        // fallback label to vendor name if empty
        if (!allowEmpty && !label.trim()) {
          const service = state.sources.find(s => s.id === id);
          const vendor = service ? findModelVendor(service.vId) : null;
          label = vendor?.name || label;
        }
        // allow max of 32 chars for the name
        if (label.length > 32)
          label = label.substring(0, 32);
        return {
          sources: state.sources.map((s: DModelsService): DModelsService =>
            s.id === id
              ? { ...s, label: label }
              : s,
          ),
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
     *  3: big-AGI v2.x upgrade
     *  4: migrate .options to .initialParameters/.userParameters
     *  4B: we changed from .chatLLMId/.fastLLMId to modelAssignments: {}, without explicit migration (done on rehydrate, and for no particular reason)
     */
    version: 4,
    migrate: (_state: any, fromVersion: number): LlmsStore => {

      if (!_state) return _state;
      const state: LlmsStore = _state;

      // 0 -> 1: add 'maxOutputTokens' where missing
      if (fromVersion < 1)
        for (const llm of state.llms)
          if (llm.maxOutputTokens === undefined) // direct access ok
            llm.maxOutputTokens = llm.contextTokens ? Math.round(llm.contextTokens / 2) : null;

      // 1 -> 2: large changes
      if (fromVersion < 2) {
        for (const llm of state.llms) {
          delete (llm as any)['tags'];
          llm.interfaces = ['oai-chat' /* this is here like this to reduce dependencies */];
          // llm.inputTypes = { 'text': {} };
        }
      }

      // 2 -> 3: big-AGI v2.x upgrade: update all models for pricing info
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
        if (!hasKeys(state.modelAssignments)) {

          // reimport the former chatLLMId and fastLLMId if set
          const prevState = state as { chatLLMId?: DLLMId, fastLLMId?: DLLMId };
          const existingAssignments: Partial<Record<DModelDomainId, DModelConfiguration>> = {};
          if (prevState.chatLLMId) {
            existingAssignments['primaryChat'] = createDModelConfiguration('primaryChat', prevState.chatLLMId, undefined);
            existingAssignments['codeApply'] = createDModelConfiguration('codeApply', prevState.chatLLMId, undefined);
            delete prevState.chatLLMId;
          }
          if (prevState.fastLLMId) {
            existingAssignments['fastUtil'] = createDModelConfiguration('fastUtil', prevState.fastLLMId, undefined);
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