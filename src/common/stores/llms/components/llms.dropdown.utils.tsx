import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import type { DLLM, DLLMId } from '../llms.types';
import type { DModelsServiceId } from '../llms.service.types';
import { findModelsServiceOrNull } from '../store-llms';
import { getLLMLabel, isLLMVisible } from '../llms.types';


/**
 * Filter LLMs for dropdown display.
 * Always includes the current model, respects starred/search/visibility filters.
 *
 * Search: every word must appear in the model label or in its service label (the group header), so 'anthropic'
 * lists the Anthropic service and 'openrouter opus' only OpenRouter's Opus. A hidden model needs a word in its own
 * label: naming a service shows it as configured, naming a model also finds the hidden ones.
 */
export function filterLLMsForDropdown(
  llms: ReadonlyArray<DLLM>,
  options: {
    currentModelId?: DLLMId | null,
    searchString?: string | null,
    starredOnly?: boolean,
  },
): DLLM[] {
  const words = options.searchString?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  const lcServiceLabels = new Map<DModelsServiceId, string>();
  if (words.length)
    for (const [sId, label] of _resolveServiceLabels(llms))
      lcServiceLabels.set(sId, label.toLowerCase());

  return llms.filter(llm => {
    // Always include the currently selected model
    if (options.currentModelId && llm.id === options.currentModelId) return true;

    // Filter by starred status
    if (options.starredOnly && !llm.userStarred) return false;

    // Not searching: visible models only
    if (!words.length) return isLLMVisible(llm);

    // Searching: every word in the model or service label; hidden models need one in their own
    const lcLabel = getLLMLabel(llm).toLowerCase();
    const lcServiceLabel = lcServiceLabels.get(llm.sId)!;
    let inLabel = false;
    for (const word of words) {
      if (lcLabel.includes(word)) inLabel = true;
      else if (!lcServiceLabel.includes(word)) return false;
    }
    return inLabel || isLLMVisible(llm);
  });
}


export interface LLMServiceGroup {
  serviceId: DModelsServiceId;
  serviceLabel: string;
  models: DLLM[];
}

/**
 * Resolve display label for each unique service in the input.
 * Fallback chain: service.label -> vendor.name -> service.id.
 */
function _resolveServiceLabels(llms: ReadonlyArray<DLLM>): Map<DModelsServiceId, string> {
  const labelById = new Map<DModelsServiceId, string>();
  for (const llm of llms) {
    if (labelById.has(llm.sId)) continue;
    const vendor = findModelVendor(llm.vId);
    labelById.set(llm.sId, findModelsServiceOrNull(llm.sId)?.label || vendor?.name || llm.sId);
  }
  return labelById;
}

/**
 * Stably sort LLMs by their service label (alphabetical, locale-aware).
 * Preserves intra-service order (e.g. starred-first), since JS sort is stable.
 */
export function sortLLMsByServiceLabel<T extends DLLM>(llms: ReadonlyArray<T>): T[] {
  if (llms.length < 2) return [...llms];
  const labelById = _resolveServiceLabels(llms);
  return [...llms].sort((a, b) => labelById.get(a.sId)!.localeCompare(labelById.get(b.sId)!));
}

/**
 * Group LLMs by service, alphabetically sorted by service label.
 * Preserves intra-service order.
 */
export function groupLLMsByService(llms: ReadonlyArray<DLLM>): LLMServiceGroup[] {
  const labelById = _resolveServiceLabels(llms);
  if (llms.length >= 2)
    llms = [...llms].sort((a, b) => labelById.get(a.sId)!.localeCompare(labelById.get(b.sId)!));

  const groups: LLMServiceGroup[] = [];
  let currentGroup: LLMServiceGroup | null = null;

  for (const llm of llms) {
    if (!currentGroup || currentGroup.serviceId !== llm.sId) {
      currentGroup = { serviceId: llm.sId, serviceLabel: labelById.get(llm.sId)!, models: [] };
      groups.push(currentGroup);
    }
    currentGroup.models.push(llm);
  }

  return groups;
}
