import { TTSVendorElevenLabs } from './vendors/elevenlabs/elevenlabs.vendor';
import { TTSVendorOpenAI } from './vendors/openai/openai-tts.vendor';

import type { ITTSVendor } from './ITTSVendor';
import type { TTSVendorId } from './tts.types';


/** Global: TTS Vendor Instances Registry **/
const TTS_VENDOR_REGISTRY: Record<TTSVendorId, ITTSVendor> = {
  elevenlabs: TTSVendorElevenLabs,
  openai: TTSVendorOpenAI,
} as Record<string, ITTSVendor>;


export function findAllTTSVendors(): ITTSVendor[] {
  const vendors = Object.values(TTS_VENDOR_REGISTRY);
  vendors.sort((a, b) => a.displayRank - b.displayRank);
  return vendors;
}

export function findTTSVendor<TServiceSettings extends object = {}, TAccess = unknown>(
  vendorId?: TTSVendorId,
): ITTSVendor<TServiceSettings, TAccess> | null {
  return vendorId ? (TTS_VENDOR_REGISTRY[vendorId] as ITTSVendor<TServiceSettings, TAccess>) ?? null : null;
}
