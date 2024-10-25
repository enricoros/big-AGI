import { getTTSEngine } from './useTTSStore';
import { findTTSVendor } from './vendors/vendors.registry';

export async function speakText(text: string, voiceId?: string) {
  const TTSEngine = getTTSEngine();
  const vendor = findTTSVendor(TTSEngine);
  if (!vendor) {
    throw new Error(`No TTS Engine found for ${TTSEngine}`);
  }
  return vendor.speakText(text, voiceId);
}

export async function EXPERIMENTAL_speakTextStream(text: string, voiceId?: string) {
  const TTSEngine = getTTSEngine();
  const vendor = findTTSVendor(TTSEngine);
  if (!vendor) {
    throw new Error(`No TTS Engine found for ${TTSEngine}`);
  }
  return vendor.EXPERIMENTAL_speakTextStream(text, voiceId);
}

export function cancel() {
  const TTSEngine = getTTSEngine();
  const vendor = findTTSVendor(TTSEngine);
  if (!vendor) {
    throw new Error(`No TTS Engine found for ${TTSEngine}`);
  }
  if (!vendor.cancel) {
    return;
  }
  return vendor.cancel();
}

export function getName() {
  const TTSEngine = getTTSEngine();
  const vendor = findTTSVendor(TTSEngine);
  if (!vendor) {
    throw new Error(`No TTS Engine found for ${TTSEngine}`);
  }
  return vendor.name;
}