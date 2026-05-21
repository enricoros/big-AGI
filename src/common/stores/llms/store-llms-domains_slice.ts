import type { StateCreator } from 'zustand/vanilla';

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DModelDomainId } from './model.domains.types';
import type { DModelParameterValues } from './llms.parameters';
import { DLLM, DLLMId, isLLMHidden, isLLMVisible } from './llms.types';
import { LlmsRootState, useModelsStore } from './store-llms';
import { ModelDomainsList, ModelDomainsRegistry } from './model.domains.registry';
import { createDModelConfiguration, DModelConfiguration } from './modelconfiguration.types';
import { type DPricingChatGenerate, getLlmCostForTokens, llmChatPricing_adjusted } from './llms.pricing';


/// LLMs Assignments Slice

type _LlmAssignments = Record<DModelDomainId, DModelConfiguration>;
type _PartialLlmAssignments = Partial<_LlmAssignments>;

export interface LlmsAssignmentsState {

  modelAssignments: _PartialLlmAssignments;

}

export interface LlmsAssignmentsActions {

  assignDomainModelId: (domainId: DModelDomainId, llmId: DLLMId | null) => void;

  autoReassignDomainModel: (domainId: DModelDomainId, ifNotPresent: boolean, ifNotVisible: boolean) => void;

}


export type LlmsAssignmentsSlice = LlmsAssignmentsState & LlmsAssignmentsActions;

export const createLlmsAssignmentsSlice: StateCreator<LlmsRootState & LlmsAssignmentsSlice, [], [], LlmsAssignmentsSlice> = (_set, _get) => ({

  // init state
  modelAssignments: {},

  // actions

  assignDomainModelId: (domainId, llmId) =>
    _set(state => {

      // auto-assign if null, to prevent a domain from being left without a model
      if (!llmId) {
        const autoLLMId = _autoSelectDomainLLMId(domainId, state.llms);
        if (autoLLMId)
          return {
            modelAssignments: {
              ...state.modelAssignments,
              [domainId]: createDModelConfiguration(domainId, autoLLMId, undefined),
            },
          };
        // if no auto-assign, fall through, which will set the model to null
      }

      return {
        modelAssignments: {
          ...state.modelAssignments,
          [domainId]: createDModelConfiguration(domainId, llmId, undefined),
        },
      };
    }),

  autoReassignDomainModel: (domainId, ifNotPresent, ifNotVisible) => {
    const { llms, modelAssignments } = _get();

    // do not perform reassignment under certain conditions
    const domainAssignment = modelAssignments[domainId] ?? undefined;
    if (domainAssignment) {
      const llmId = domainAssignment.modelId;
      if (llmId) {
        if (!ifNotPresent)
          return; // assigned and maybe present: nothing to do
        // check if present
        const llm = llms.find(({ id }) => id === llmId);
        if (llm) {
          if (!ifNotVisible)
            return; // present and maybe visible: nothing to do
          if (isLLMVisible(llm))
            return; // present and visible: nothing to do
        }
      }
    }

    // re-assign
    const autoLLMId = _autoSelectDomainLLMId(domainId, llms);
    if (autoLLMId)
      _set(state => ({
        modelAssignments: {
          ...state.modelAssignments,
          [domainId]: createDModelConfiguration(domainId, autoLLMId, undefined),
        },
      }));
  },

});


// --- Heuristics ---

type RankedVendorLLMs = {
  vendorId: ModelVendorId,
  llmsByElo: {
    id: DLLMId,
    cbaElo: number | undefined,
    costRank: number | undefined,
  }[],
};
type PreferredRankedVendors = RankedVendorLLMs[];


/**
 * Heuristics to return the top LLMs from different vendors (diverse), based on their elo,
 * until there are vendors, otherwise loops, and pads with the fallback.
 *
 * @param count returns up to this number of LLMs
 * @param requireElo if true, only LLMs with elo are returned
 * @param fallback the LLM to use if there are not enough LLMs
 */
export function llmsHeuristicGetTopDiverseLlmIds(count: number, requireElo: boolean, fallback?: DLLMId): DLLMId[] {
  const llmIDs: DLLMId[] = [];

  // iterate through the groups, and top to bottom
  const { llms } = useModelsStore.getState();
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


/**
 * Heuristics to return fast/low-cost LLMs from different vendors,
 * using the same strategy as utility models (topVendorLowestCost).
 * Round-robin picks the lowest-cost model from each vendor.
 */
export function llmsHeuristicGetTopFastLlmIds(count: number): DLLMId[] {
  const llmIDs: DLLMId[] = [];

  const { llms } = useModelsStore.getState();
  const groupedLlms = _groupLlmsByVendorRankedByElo(llms);

  // For each vendor, sort by cost (lowest first, excluding free/0-cost)
  const vendorsByCost = groupedLlms.map(vendor => ({
    vendorId: vendor.vendorId,
    llmsByCost: vendor.llmsByElo.toSorted((a, b) => {
      if (!a.costRank && !b.costRank) return 0;
      if (!a.costRank) return 1; // push 0-cost to end
      if (!b.costRank) return -1;
      return a.costRank - b.costRank;
    }),
  }));

  // Round-robin pick lowest-cost models from each vendor
  let costLevel = 0;
  while (llmIDs.length < count) {
    let added = false;

    for (const vendor of vendorsByCost) {
      if (costLevel < vendor.llmsByCost.length) {
        const llmEntry = vendor.llmsByCost[costLevel];
        if (!llmEntry.id) continue;
        llmIDs.push(llmEntry.id);
        added = true;
        if (llmIDs.length === count) break; // fast exit
      }
    }

    if (!added) break;
    costLevel++;
  }

  return llmIDs;
}

/**
 * Heuristic to return starred LLMs from all vendors.
 */
export function llmsHeuristicGetStarredLlmIds(): DLLMId[] {
  const { llms } = useModelsStore.getState();
  const starredLlms = llms.filter(llm => llm.userStarred && llm.id);
  return starredLlms.map(llm => llm.id);
}


/**
 * Prune-only reconciliation: drop explicit assignments that reference to a no longer existing LLM.
 * Dropped or missing entities mean 'Auto' and are resolved read-time.
 *
 * Called by LLM global list (universe) mutation and initial store rehydration.
 */
export function llmsHeuristicUpdateAssignments(universe: ReadonlyArray<DLLM>, existingAssignments: _PartialLlmAssignments): _PartialLlmAssignments {
  const result: _PartialLlmAssignments = {};
  for (const domainId of ModelDomainsList) {

    // absent = Auto, keep absent
    const existing = existingAssignments[domainId];
    if (!existing) continue;

    // valid pin or explicit 'no model'
    if (existing.modelId === null || universe.find(({ id }) => id === existing.modelId))
      result[domainId] = existing;

    // else: broken pin -> drop the entry (degrades to Auto)
  }
  return result;
}


// Public - Auto Model Selection

export function createDModelConfigurationAuto(domainId: DModelDomainId, modelParameters: DModelParameterValues | undefined): DModelConfiguration | undefined {
  const { llms } = useModelsStore.getState();
  const autoLLMId = _autoSelectDomainLLMId(domainId, llms);
  return autoLLMId ? createDModelConfiguration(domainId, autoLLMId, modelParameters) : undefined;
}


// Private - Strategies

function _autoSelectDomainLLMId(domainId: DModelDomainId, llms: ReadonlyArray<DLLM>): DLLMId | undefined {
  const domainSpec = ModelDomainsRegistry[domainId] ?? undefined;

  // Filter LLMs based on required interfaces, but relax the filter if none matches
  let filteredLlms = llms;
  if (domainSpec.requiredInterfaces?.length) {
    const reqIfs = domainSpec.requiredInterfaces;
    const subset = llms.filter(llm => reqIfs.every(reqIf => llm.interfaces.includes(reqIf)));
    // only apply filter if we have at least one matching model
    if (subset.length > 0)
      filteredLlms = subset;
  }

  // Now group the final chosen set
  const vendors = _groupLlmsByVendorRankedByElo(filteredLlms);

  // Apply the domain selection strategy
  switch (domainSpec?.autoStrategy) {

    case 'topVendorTopLlm':
      return _strategyTopQuality(vendors);

    case 'topVendorLowestCost':
      return _strategyTopVendorLowestCost(vendors);

    default:
      console.log('[DEV] unknown strategy for LLM domain', domainId);
  }

  // console.log('[DEV] cannot auto-assign for domain', domainId, llms.length, filteredLlms.length);
  return undefined;
}

function _strategyTopQuality(vendors: PreferredRankedVendors): DLLMId | undefined {
  // return the 1st vendor, 1st model -- great if ranked, but if not, at least return one model
  return vendors.length ? vendors[0].llmsByElo[0]?.id : undefined;
}

function _strategyTopVendorLowestCost(vendors: PreferredRankedVendors, requireEloRating: boolean = true): DLLMId | undefined {

  // based on the assumption that the lowest (but non-zero) cost will happen for:
  // - newest models
  // - which also means better models (if the assumption holds over time)
  // if the top provider doesn't have any, we move to the second, etc.

  if (!vendors.length) return undefined;
  for (const vendor of vendors) {

    // sort by increasing cost, with 0 ('free' at the end, to exclude experimental models)
    const sorted = vendor.llmsByElo.toSorted((a, b) => {
      if (!a.costRank && !b.costRank)
        return 0;
      if (!a.costRank)
        return 1;
      if (!b.costRank)
        return -1;
      return a.costRank - b.costRank;
    });

    // get the first that has cbaElo, assuming those are more 'social proofed' models
    if (requireEloRating) {
      const firstWithElo = sorted.find(llm => llm.cbaElo);
      if (firstWithElo)
        return firstWithElo.id;
    }

    if (sorted.length && sorted[0].id)
      return sorted[0].id;
  }
  return undefined;
}


// Private - LLM ELO Ranking functions

function _groupLlmsByVendorRankedByElo(llms: ReadonlyArray<DLLM>): PreferredRankedVendors {
  // group all LLMs by vendor
  const grouped = llms.reduce((acc, llm) => {
    if (isLLMHidden(llm)) return acc;
    const group = acc.find(v => v.vendorId === llm.vId);
    // adjustd: includes price multipliers
    const adjChatPricing = llmChatPricing_adjusted(llm);
    const eloCostItem = {
      id: llm.id,
      cbaElo: llm.benchmark?.cbaElo,
      costRank: !adjChatPricing ? undefined : _getLlmCostBenchmarkFromPricing(adjChatPricing),
    };
    if (!group)
      acc.push({ vendorId: llm.vId, llmsByElo: [eloCostItem] });
    else
      group.llmsByElo.push(eloCostItem);
    return acc;
  }, [] as PreferredRankedVendors);

  // sort each vendor's LLMs by elo, decreasing
  for (const vendor of grouped)
    vendor.llmsByElo.sort((a, b) => (b.cbaElo ?? -1) - (a.cbaElo ?? -1));

  // sort all vendors by their highest elo, decreasing
  grouped.sort((a, b) => (b.llmsByElo[0].cbaElo ?? -1) - (a.llmsByElo[0].cbaElo ?? -1));
  return grouped;
}

// Hypothetical cost benchmark for a model, based on total cost of 100k input tokens and 10k output tokens.
function _getLlmCostBenchmarkFromPricing(chatPricing: DPricingChatGenerate): number | undefined {
  const costIn = getLlmCostForTokens(100000, 100000, chatPricing.input);
  const costOut = getLlmCostForTokens(100000, 10000, chatPricing.output);
  return (costIn !== undefined && costOut !== undefined) ? costIn + costOut : undefined;
}
