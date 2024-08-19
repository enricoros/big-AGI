//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DOpenRouterServiceSettings } from '~/modules/llms/vendors/openrouter/openrouter.vendor';
import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DLLM, DLLMId } from './llms.types';
import type { DModelsService, DModelsServiceId } from './modelsservice.types';
import { portModelPricingV2toV3 } from './llms.pricing';


/// ModelsStore - a store for configured LLMs and configured services

interface LlmsState {

  llms: DLLM<any>[];

  sources: DModelsService<any>[];

  chatLLMId: DLLMId | null;
  fastLLMId: DLLMId | null;
  funcLLMId: DLLMId | null;

}

interface LlmsActions {

  setLLMs: (llms: DLLM[], serviceId: DModelsServiceId, deleteExpiredVendorLlms: boolean, keepUserEdits: boolean) => void;
  removeLLM: (id: DLLMId) => void;
  updateLLM: (id: DLLMId, partial: Partial<DLLM>) => void;
  updateLLMOptions: <TLLMOptions>(id: DLLMId, partialOptions: Partial<TLLMOptions>) => void;

  addService: (service: DModelsService) => void;
  removeService: (id: DModelsServiceId) => void;
  updateServiceSettings: <TServiceSettings>(id: DModelsServiceId, partialSettings: Partial<TServiceSettings>) => void;

  setChatLLMId: (id: DLLMId | null) => void;
  setFastLLMId: (id: DLLMId | null) => void;
  setFuncLLMId: (id: DLLMId | null) => void;

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
    funcLLMId: null,


    // actions

    setChatLLMId: (id: DLLMId | null) =>
      set(state => _heuristicUpdateSelectedLLMs(state.llms, id, state.fastLLMId, state.funcLLMId)),

    setFastLLMId: (id: DLLMId | null) =>
      set(state => _heuristicUpdateSelectedLLMs(state.llms, state.chatLLMId, id, state.funcLLMId)),

    setFuncLLMId: (id: DLLMId | null) =>
      set(state => _heuristicUpdateSelectedLLMs(state.llms, state.chatLLMId, state.fastLLMId, id)),

    setLLMs: (llms: DLLM[], serviceId: DModelsServiceId, deleteExpiredVendorLlms: boolean, keepUserEdits: boolean) =>
      set(state => {

        // keep existing model customizations
        if (keepUserEdits) {
          llms = llms.map((llm: DLLM): DLLM => {
            const existing = state.llms.find(m => m.id === llm.id);
            return !existing ? llm : {
              ...llm,
              label: existing.label, // keep label
              hidden: existing.hidden, // keep hidden
              options: { ...existing.options, ...llm.options }, // keep custom configurations, but overwrite as the new could have massively improved params
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
          ..._heuristicUpdateSelectedLLMs(newLlms, state.chatLLMId, state.fastLLMId, state.funcLLMId),
        };
      }),

    removeLLM: (id: DLLMId) =>
      set(state => {
        const newLlms = state.llms.filter(llm => llm.id !== id);
        return {
          llms: newLlms,
          ..._heuristicUpdateSelectedLLMs(newLlms, state.chatLLMId, state.fastLLMId, state.funcLLMId),
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

    updateLLMOptions: <TLLMOptions>(id: DLLMId, partialOptions: Partial<TLLMOptions>) =>
      set(state => ({
        llms: state.llms.map((llm: DLLM): DLLM =>
          llm.id === id
            ? { ...llm, options: { ...llm.options, ...partialOptions } }
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
          ..._heuristicUpdateSelectedLLMs(llms, state.chatLLMId, state.fastLLMId, state.funcLLMId),
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
     */
    version: 3,
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
          llm.interfaces = ['oai-chat'];
          // llm.inputTypes = { 'text': {} };
        }
        state.chatLLMId = null;
        state.fastLLMId = null;
        state.funcLLMId = null;
      }

      // 2 -> 3: big-AGI v2: update all models for pricing info
      if (fromVersion < 3)
        state.llms.forEach(portModelPricingV2toV3);

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
        if (!state.chatLLMId || !state.fastLLMId || !state.funcLLMId)
          Object.assign(state, _heuristicUpdateSelectedLLMs(state.llms, state.chatLLMId, state.fastLLMId, state.funcLLMId));
      } catch (error) {
        console.error('Error in autoPickModels', error);
      }
    },

  },
));


export function findLLMOrThrow<TLLMOptions>(llmId: DLLMId): DLLM<TLLMOptions> {
  const llm: DLLM<TLLMOptions> | undefined = llmsStoreState().llms.find(llm => llm.id === llmId);
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

export function getFastLLMId(): DLLMId | null {
  return llmsStoreState().fastLLMId;
}

export function getFuncLLMId(): DLLMId | null {
  return llmsStoreState().funcLLMId;
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
  const { llms, sources, chatLLMId, fastLLMId, funcLLMId } = llmsStoreState();
  return { services: sources.length, llmsCount: llms.length, chatId: chatLLMId, fastId: fastLLMId, funcId: funcLLMId };
}

function _heuristicUpdateSelectedLLMs(allLlms: DLLM[], chatLlmId: DLLMId | null, fastLlmId: DLLMId | null, funcLlmId: DLLMId | null) {

  // the output of _groupLlmsByVendorRankedByElo
  let grouped: ReturnType<typeof _groupLlmsByVendorRankedByElo> | null = null;

  function cachedGrouped() {
    if (!grouped) grouped = _groupLlmsByVendorRankedByElo(allLlms);
    return grouped;
  }

  // the best llm
  if (!chatLlmId || !allLlms.find(llm => llm.id === chatLlmId)) {
    const vendors = cachedGrouped();
    chatLlmId = vendors.length ? vendors[0].llmsByElo[0].id : null;
  }

  // a fast llm (bottom elo of the top vendor ~~ not really a proxy, but not sure which heuristic to use here)
  if (!fastLlmId && !allLlms.find(llm => llm.id === fastLlmId)) {
    const vendors = cachedGrouped();
    fastLlmId = vendors.length
      ? vendors[0].llmsByElo.findLast(llm => llm.cbaElo)?.id // last with ELO
      ?? vendors[0].llmsByElo[vendors[0].llmsByElo.length - 1].id ?? null // last
      : null;
  }

  // a func llm (same as chat for now, hoping the highest grade also has function calling)
  if (!funcLlmId || !allLlms.find(llm => llm.id === funcLlmId))
    funcLlmId = chatLlmId;

  return { chatLLMId: chatLlmId, fastLLMId: fastLlmId, funcLLMId: funcLlmId };
}

function _groupLlmsByVendorRankedByElo(llms: DLLM[]): { vendorId: ModelVendorId, llmsByElo: { id: DLLMId, cbaElo: number | undefined }[] }[] {
  // group all LLMs by vendor
  const grouped = llms.reduce((acc, llm) => {
    if (llm.hidden) return acc;
    const vendor = acc.find(v => v.vendorId === llm.vId);
    if (!vendor) {
      acc.push({
        vendorId: llm.vId,
        llmsByElo: [{
          id: llm.id,
          cbaElo: llm.benchmark?.cbaElo,
        }],
      });
    } else {
      vendor.llmsByElo.push({
        id: llm.id,
        cbaElo: llm.benchmark?.cbaElo,
      });
    }
    return acc;
  }, [] as { vendorId: ModelVendorId, llmsByElo: { id: DLLMId, cbaElo: number | undefined }[] }[]);

  // sort each vendor's LLMs by elo, decreasing
  for (const vendor of grouped)
    vendor.llmsByElo.sort((a, b) => (b.cbaElo ?? -1) - (a.cbaElo ?? -1));

  // sort all vendors by their highest elo, decreasing
  grouped.sort((a, b) => (b.llmsByElo[0].cbaElo ?? -1) - (a.llmsByElo[0].cbaElo ?? -1));
  return grouped;
}
