import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DSpeexEngineAny, DSpeexVendorType } from './speex.types';
import type { ISpeexVendor, ISpeexVendorAny } from './ISpeexVendor';

// vendor imports (will be implemented as stubs initially)
import { SpeexVendorElevenLabs } from './vendors/elevenlabs.vendor';
import { SpeexVendorLocalAI } from './vendors/localai.vendor';
import { SpeexVendorOpenAI } from './vendors/openai.vendor';
import { SpeexVendorWebSpeech } from './vendors/webspeech.vendor';


// registry of Speex Vendors, for engine creation, priority ranking, etc.

const _SPEEX_VENDOR_REGISTRY: { [key in DSpeexVendorType]: ISpeexVendor<key> } = {
  elevenlabs: SpeexVendorElevenLabs,
  localai: SpeexVendorLocalAI,
  openai: SpeexVendorOpenAI,
  webspeech: SpeexVendorWebSpeech,
};


// Speex Vendors API

export function speexFindVendor<TVt extends DSpeexVendorType>(vendorType: TVt): ISpeexVendor<TVt> | null {
  return _SPEEX_VENDOR_REGISTRY[vendorType] ?? null;
}

export function speexFindVendorForLLMVendor(llmVendorId: ModelVendorId): ISpeexVendorAny | null {
  for (const sv of Object.values(_SPEEX_VENDOR_REGISTRY))
    if (sv.autoFromLlmVendorIds?.includes(llmVendorId))
      return sv;
  return null;
}

export function speexFindByVendorPriorityAsc(engines: DSpeexEngineAny[]): DSpeexEngineAny | null {
  for (const sv of _speexFindAllVendors_Asc()) {
    const engine = engines.find(e => e.vendorType === sv.vendorType);
    if (engine) return engine;
  }
  return null;
}


function _speexFindAllVendors_Asc(): ISpeexVendorAny[] {
  return Object.values(_SPEEX_VENDOR_REGISTRY)
    .sort((a, b) => a.priority - b.priority);
}
