import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DT2IEngineAny, DT2IVendorType } from './t2i.types';
import type { IT2IVendor, IT2IVendorAny } from './IT2IVendor';

// vendor imports
import { T2IVendorAzure } from './vendors/azure.vendor';
import { T2IVendorLocalAI } from './vendors/localai.vendor';
import { T2IVendorOpenAI } from './vendors/openai.vendor';
import { T2IVendorOpenRouter } from './vendors/openrouter.vendor';


// registry of T2I Vendors, for engine creation, priority ranking, etc.

const _T2I_VENDOR_REGISTRY: { [key in DT2IVendorType]: IT2IVendor<key> } = {
  openai: T2IVendorOpenAI,
  azure: T2IVendorAzure,
  localai: T2IVendorLocalAI,
  openrouter: T2IVendorOpenRouter,
};


// T2I Vendors API

export function t2iFindVendor<TVt extends DT2IVendorType>(vendorType: TVt): IT2IVendor<TVt> | null {
  return _T2I_VENDOR_REGISTRY[vendorType] ?? null;
}

export function t2iFindVendorForLLMVendor(llmVendorId: ModelVendorId): IT2IVendorAny | null {
  for (const tv of Object.values(_T2I_VENDOR_REGISTRY))
    if (tv.autoFromLlmVendorIds?.includes(llmVendorId))
      return tv;
  return null;
}

/** UI: generator (painter) display name for an engine, via its vendor */
export function t2iEngineGeneratorName(engine: DT2IEngineAny): string {
  const vendor = t2iFindVendor(engine.vendorType);
  // the engine's profile matches its vendor by construction
  return vendor ? vendor.generatorName(engine.profile as never) : engine.vendorType;
}
