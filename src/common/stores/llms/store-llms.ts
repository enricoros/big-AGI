//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DOpenRouterServiceSettings } from '~/modules/llms/vendors/openrouter/openrouter.vendor';
import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DModelParameterId } from './llms.parameters';
import type { DModelsService, DModelsServiceId } from './modelsservice.types';
import { DLLM, DLLMId, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from './llms.types';
import { getLlmCostForTokens, portModelPricingV2toV3 } from './llms.pricing';


/// ModelsStore - a store for configured LLMs and configured services

interface LlmsState {

  llms: DLLM[];

  sources: DModelsService<any>[];

  chatLLMId: DLLMId | null;
  fastLLMId: DLLMId | null;

}

interface LlmsActions {

  setLLMs: (llms: DLLM[], serviceId: DModelsServiceId, deleteExpiredVendorLlms: boolean, keepUserEdits: boolean) => void;
  removeLLM: (id: DLLMId) => void;
  rerankLLMsByServices: (serviceIdOrder: DModelsServiceId[]) => void;
  updateLLM: (id: DLLMId, partial: Partial<DLLM>) => void;
  updateLLMUserParameters: (id: DLLMId, partial: Partial<DLLM['userParameters']>) => void;
  deleteLLMUserParameter: (id: DLLMId, parameterId: DModelParameterId) => void;

  addService: (service: DModelsService) => void;
  removeService: (id: DModelsServiceId) => void;
  updateServiceSettings: <TServiceSettings>(id: DModelsServiceId, partialSettings: Partial<TServiceSettings>) => void;

  setChatLLMId: (id: DLLMId | null) => void;
  setFastLLMId: (id: DLLMId | null) => void;

  // special
  setOpenRouterKey: (key: string) => void;

}

export const useModelsStore = create<LlmsState & LlmsActions>()(persist(
  (set) => ({

    // initial state

    llms: [],
    sources: [],

    chatLLMId: null,
    fastLLMId: null,


    // actions

    setChatLLMId: (id: DLLMId | null) =>
      set(state => _heuristicUpdateSelectedLLMs(state.llms, id, state.fastLLMId)),

    setFastLLMId: (id: DLLMId | null) =>
      set(state => _heuristicUpdateSelectedLLMs(state.llms, state.chatLLMId, id)),

    setLLMs: (llms: DLLM[], serviceId: DModelsServiceId, deleteExpiredVendorLlms: boolean, keepUserEdits: boolean) =>
      set(state => {

        // keep existing model customizations
        if (keepUserEdits) {
          llms = llms.map((llm: DLLM): DLLM => {
            const existing = state.llms.find(m => m.id === llm.id);
            return !existing ? llm : {
              ...llm,
              ...(existing.userLabel !== undefined ? { userLabel: existing.userLabel } : {}),
              ...(existing.userHidden !== undefined ? { userHidden: existing.userHidden } : {}),
              ...(existing.userParameters !== undefined ? { userParameters: { ...existing.userParameters } } : {}),
            };
          });
        }

        const otherLlms = deleteExpiredVendorLlms
          ? state.llms.filter(llm => llm.sId !== serviceId)
          : state.llms;

        // replace existing llms with the same id
        const newLlms = [...llms, ...otherLlms.filter(llm => !llms.find(m => m.id === llm.id))];
        return {
          llms: newLlms,
          ..._heuristicUpdateSelectedLLMs(newLlms, state.chatLLMId, state.fastLLMId),
        };
      }),

    removeLLM: (id: DLLMId) =>
      set(state => {
        const newLlms = state.llms.filter(llm => llm.id !== id);
        return {
          llms: newLlms,
          ..._heuristicUpdateSelectedLLMs(newLlms, state.chatLLMId, state.fastLLMId),
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

    updateLLMUserParameters: (id: DLLMId, partialUserParameters: Partial<DLLM['userParameters']>) =>
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

    addService: (service: DModelsService) =>
      set(state => {
        // re-number all services for the given vendor
        const sameVendor = service.vId;
        let n = 0;
        return {
          sources: [...state.sources, service].map((s: DModelsService): DModelsService =>
            s.vId === sameVendor
              ? {
                ...s,
                label: s.label.replace(/ #\d+$/, '') + (++n > 1 ? ` #${n}` : ''),
              }
              : s,
          ),
        };
      }),

    removeService: (id: DModelsServiceId) =>
      set(state => {
        const llms = state.llms.filter(llm => llm.sId !== id);
        return {
          llms,
          sources: state.sources.filter(s => s.id !== id),
          ..._heuristicUpdateSelectedLLMs(llms, state.chatLLMId, state.fastLLMId),
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
     */
    version: 4,
    migrate: (_state: any, fromVersion: number): LlmsState => {

      if (!_state) return _state;
      const state: LlmsState = _state;

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
        state.chatLLMId = null;
        state.fastLLMId = null;
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
        if (!state.chatLLMId || !state.fastLLMId)
          Object.assign(state, _heuristicUpdateSelectedLLMs(state.llms, state.chatLLMId, state.fastLLMId));
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
  return llmsStoreState().chatLLMId;
}


export function getLLMIdOrThrow(order: ('chat' | 'fast')[], supportsFunctionCallTool: boolean, supportsImageInput: boolean, useCaseLabel: string): DLLMId {
  const { chatLLMId, fastLLMId } = llmsStoreState();

  for (const preference of order) {
    const llmId = preference === 'chat' ? chatLLMId : fastLLMId;
    // we don't have one of those assigned, skip
    if (!llmId)
      continue;
    try {
      const llm = findLLMOrThrow(llmId);
      if (supportsFunctionCallTool && !llm.interfaces.includes(LLM_IF_OAI_Fn))
        continue;
      if (supportsImageInput && !llm.interfaces.includes(LLM_IF_OAI_Vision))
        continue;
      return llmId;
    } catch (error) {
      // Try next or fall back to the error
    }
  }

  throw new Error(`No model available for '${useCaseLabel}'. Pease select a ${order.join(' or ')} model that supports${supportsFunctionCallTool ? ' function calls' : ' text input'}${supportsImageInput ? ' and image input' : ''} in the Model Configuration.`);
}


export function llmsStoreState(): LlmsState & LlmsActions {
  return useModelsStore.getState();
}

export function llmsStoreActions(): LlmsActions {
  return useModelsStore.getState();
}


/**
 * Heuristics to return the top LLMs from different vendors (diverse), based on their elo,
 * until there are vendors, otherwise loops, and pads with the fallback.
 *
 * @param count returns up to this number of LLMs
 * @param requireElo if true, only LLMs with elo are returned
 * @param fallback the LLM to use if there are not enough LLMs
 */
export function getDiverseTopLlmIds(count: number, requireElo: boolean, fallback: DLLMId | null): DLLMId[] {
  const llmIDs: DLLMId[] = [];

  // iterate through the groups, and top to bottom
  const llms = llmsStoreState().llms;
  const groupedLlms = _groupLlmsByVendorRankedByElo(llms);
  let groupLevel = 0;
  while (llmIDs.length < count) {
    let added = false;

    for (const group of groupedLlms) {
      if (groupLevel < group.llmsByElo.length) {
        const llmEntry = group.llmsByElo[groupLevel];
        if (!llmEntry.id || (requireElo && llmEntry.cbaElo === undefined))
          continue;
        llmIDs.push(llmEntry.id);
        added = true;
        if (llmIDs.length === count) break; // fast exit
      }
    }

    if (!added)
      break;
    groupLevel++;
  }

  // pad with the fallback
  while (llmIDs.length < count && fallback)
    llmIDs.push(fallback);

  return llmIDs;
}

export function getLLMsDebugInfo() {
  const { llms, sources, chatLLMId, fastLLMId } = llmsStoreState();
  return { services: sources.length, llmsCount: llms.length, chatId: chatLLMId, fastId: fastLLMId };
}

function _heuristicUpdateSelectedLLMs(allLlms: DLLM[], chatLlmId: DLLMId | null, fastLlmId: DLLMId | null) {

  let grouped: GroupedVendorLLMs;

  function cachedGrouped() {
    if (!grouped) grouped = _groupLlmsByVendorRankedByElo(allLlms);
    return grouped;
  }

  // default Chat: top vendor by Elo, top model
  if (!chatLlmId || !allLlms.find(llm => llm.id === chatLlmId)) {
    const vendors = cachedGrouped();
    chatLlmId = vendors.length ? vendors[0].llmsByElo[0].id : null;
  }

  // default Fast: vendors by Elo, lowest cost (if available)
  if (!fastLlmId || !allLlms.find(llm => llm.id === fastLlmId)) {
    const vendors = cachedGrouped();
    fastLlmId = _selectFastLlmID(vendors);
  }

  return { chatLLMId: chatLlmId, fastLLMId: fastLlmId };
}


type BenchVendorLLMs = { vendorId: ModelVendorId, llmsByElo: { id: DLLMId, cbaElo: number | undefined, costRank: number | undefined }[] };
type GroupedVendorLLMs = BenchVendorLLMs[];

function _groupLlmsByVendorRankedByElo(llms: DLLM[]): GroupedVendorLLMs {
  // group all LLMs by vendor
  const grouped = llms.reduce((acc, llm) => {
    if (llm.hidden) return acc;
    const group = acc.find(v => v.vendorId === llm.vId);
    const eloCostItem = {
      id: llm.id,
      cbaElo: llm.benchmark?.cbaElo,
      costRank: !llm.pricing ? undefined : _getLlmCostBenchmark(llm),
    };
    if (!group)
      acc.push({ vendorId: llm.vId, llmsByElo: [eloCostItem] });
    else
      group.llmsByElo.push(eloCostItem);
    return acc;
  }, [] as GroupedVendorLLMs);

  // sort each vendor's LLMs by elo, decreasing
  for (const vendor of grouped)
    vendor.llmsByElo.sort((a, b) => (b.cbaElo ?? -1) - (a.cbaElo ?? -1));

  // sort all vendors by their highest elo, decreasing
  grouped.sort((a, b) => (b.llmsByElo[0].cbaElo ?? -1) - (a.llmsByElo[0].cbaElo ?? -1));
  return grouped;
}

// Hypothetical cost benchmark for a model, based on total cost of 100k input tokens and 10k output tokens.
function _getLlmCostBenchmark(llm: DLLM): number | undefined {
  if (!llm.pricing?.chat) return undefined;
  const costIn = getLlmCostForTokens(100000, 100000, llm.pricing.chat.input);
  const costOut = getLlmCostForTokens(100000, 10000, llm.pricing.chat.output);
  return (costIn !== undefined && costOut !== undefined) ? costIn + costOut : undefined;
}

// Selects the 'fast' llm
function _selectFastLlmID(vendors: GroupedVendorLLMs) {
  if (!vendors.length) return null;
  for (const vendor of vendors) {
    const lowestCostLlm = vendor.llmsByElo.reduce((acc, llm) => {
      if (!acc)
        return llm;
      if (!llm.costRank || !acc.costRank)
        return acc;
      return llm.costRank < acc.costRank ? llm : acc;
    }, null as BenchVendorLLMs['llmsByElo'][number] | null);
    if (lowestCostLlm)
      return lowestCostLlm.id;
  }
  return null;
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