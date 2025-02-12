import type { StateCreator } from 'zustand/vanilla';

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DLLM, DLLMId } from './llms.types';
import { LlmsRootState, useModelsStore } from './store-llms';
import { getLlmCostForTokens } from './llms.pricing';


/// LLMs Assignments Slice

export interface LlmsAssignmentsState {

  chatLLMId: DLLMId | null;
  fastLLMId: DLLMId | null;

}

export interface LlmsAssignmentsActions {

  setChatLLMId: (id: DLLMId | null) => void;
  setFastLLMId: (id: DLLMId | null) => void;

}


export type LlmsAssignmentsSlice = LlmsAssignmentsState & LlmsAssignmentsActions;

export const createLlmsAssignmentsSlice: StateCreator<LlmsRootState & LlmsAssignmentsSlice, [], [], LlmsAssignmentsSlice> = (set, get) => ({

  // init state
  chatLLMId: null,
  fastLLMId: null,

  // actions

  setChatLLMId: (id: DLLMId | null) =>
    set(state => llmsHeuristicUpdateAssignments(state.llms, id, state.fastLLMId)),

  setFastLLMId: (id: DLLMId | null) =>
    set(state => llmsHeuristicUpdateAssignments(state.llms, state.chatLLMId, id)),

});


// --- Heuristics ---

type BenchVendorLLMs = { vendorId: ModelVendorId, llmsByElo: { id: DLLMId, cbaElo: number | undefined, costRank: number | undefined }[] };
type GroupedVendorLLMs = BenchVendorLLMs[];


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


export function llmsHeuristicUpdateAssignments(allLlms: DLLM[], chatLlmId: DLLMId | null, fastLlmId: DLLMId | null) {

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
