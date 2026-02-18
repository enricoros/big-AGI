import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import type { DLLM, DLLMId } from '../llms.types';
import type { DModelsServiceId } from '../llms.service.types';
import { findModelsServiceOrNull } from '../store-llms';
import { getLLMLabel, isLLMVisible } from '../llms.types';


/**
 * Filter LLMs for dropdown display.
 * Always includes the current model, respects starred/search/visibility filters.
 */
export function filterLLMsForDropdown(
  llms: ReadonlyArray<DLLM>,
  options: {
    currentModelId?: DLLMId | null,
    searchString?: string | null,
    starredOnly?: boolean,
  },
): DLLM[] {
  const lcSearch = options.searchString?.toLowerCase();
  return llms.filter(llm => {
    // Always include the currently selected model
    if (options.currentModelId && llm.id === options.currentModelId) return true;

    // Filter by starred status
    if (options.starredOnly && !llm.userStarred) return false;

    // Filter by search string
    if (lcSearch && !getLLMLabel(llm).toLowerCase().includes(lcSearch)) return false;

    // Show visible models, or all if actively searching
    return lcSearch ? true : isLLMVisible(llm);
  });
}


export interface LLMServiceGroup {
  serviceId: DModelsServiceId;
  serviceLabel: string;
  models: DLLM[];
}

/**
 * Group LLMs by service, resolving service display labels.
 */
export function groupLLMsByService(llms: ReadonlyArray<DLLM>): LLMServiceGroup[] {
  const groups: LLMServiceGroup[] = [];
  let currentGroup: LLMServiceGroup | null = null;

  for (const llm of llms) {
    if (!currentGroup || currentGroup.serviceId !== llm.sId) {
      const vendor = findModelVendor(llm.vId);
      const serviceLabel = findModelsServiceOrNull(llm.sId)?.label || vendor?.name || llm.sId;
      currentGroup = { serviceId: llm.sId, serviceLabel, models: [] };
      groups.push(currentGroup);
    }
    currentGroup.models.push(llm);
  }

  return groups;
}
