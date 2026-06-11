import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DASRxEngineAny, DASRxVendorType } from './asrx.types';
import type { ASRxProtocol, IASRxVendor, IASRxVendorAny } from './IASRxVendor';

// vendor imports
import { ASRxVendorDeepgram } from './vendors/deepgram.vendor';
import { ASRxVendorOpenAI } from './vendors/openai.vendor';


// registry of ASRx Vendors, for engine creation, priority ranking, etc.

const _ASRX_VENDOR_REGISTRY: { [key in DASRxVendorType]: IASRxVendor<key> } = {
  deepgram: ASRxVendorDeepgram,
  openai: ASRxVendorOpenAI,
};


// ASRx Vendors API

export function asrxFindVendor<TVt extends DASRxVendorType>(vendorType: TVt): IASRxVendor<TVt> | null {
  return _ASRX_VENDOR_REGISTRY[vendorType] ?? null;
}

export function asrxFindVendorForLLMVendor(llmVendorId: ModelVendorId): IASRxVendorAny | null {
  for (const av of Object.values(_ASRX_VENDOR_REGISTRY))
    if (av.autoFromLlmVendorIds?.includes(llmVendorId))
      return av;
  return null;
}

/**
 * Given a set of candidate engines, return the one whose vendor has the lowest priority number
 * (= highest preference). Used for global engine fallback.
 */
export function asrxFindByVendorPriorityAsc(engines: DASRxEngineAny[]): DASRxEngineAny | null {
  for (const av of _asrxFindAllVendors_Asc()) {
    const engine = engines.find(e => e.vendorType === av.vendorType);
    if (engine) return engine;
  }
  return null;
}

/**
 * Return all vendors that declare support for a specific protocol, in priority order.
 */
export function asrxFindVendorsByProtocol(protocol: ASRxProtocol): IASRxVendorAny[] {
  return _asrxFindAllVendors_Asc().filter(v => v.protocols.has(protocol));
}


function _asrxFindAllVendors_Asc(): IASRxVendorAny[] {
  return Object.values(_ASRX_VENDOR_REGISTRY)
    .sort((a, b) => a.priority - b.priority);
}
