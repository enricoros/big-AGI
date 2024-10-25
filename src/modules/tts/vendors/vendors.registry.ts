import { TTSEngineKey } from '../useTTSStore';
import { elevenlabs } from './elevenlabs/elevenlabs.vendor';
import { ISpeechSynthesis } from './ISpeechSynthesis';
import { webspeech } from './webspeech/webspeech.vendor';

/** Global: Vendor Instances Registry **/
const MODEL_VENDOR_REGISTRY: Record<TTSEngineKey, ISpeechSynthesis> = {
  elevenlabs:elevenlabs,
  webspeech:webspeech,
} as Record<string, ISpeechSynthesis>;

export function findAllTTSVendors(): ISpeechSynthesis[] {
  const modelVendors = Object.values(MODEL_VENDOR_REGISTRY);
  return modelVendors;
}

export function findTTSVendor(TTSEngineKey?: TTSEngineKey): ISpeechSynthesis | null {
  return TTSEngineKey ? ((MODEL_VENDOR_REGISTRY[TTSEngineKey] as ISpeechSynthesis) ?? null) : null;
}
