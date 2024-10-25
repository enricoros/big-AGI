import { getTTSEngine } from './useTTSStore';
import { findTTSVendor } from './vendors/vendors.registry';

export function useTTSCapability() {
  const TTSEngine = getTTSEngine();
  const vendor = findTTSVendor(TTSEngine);
  if (!vendor) {
    throw new Error(`No TTS Engine found for ${TTSEngine}`);
  }
  return vendor.getCapabilityInfo();
}
