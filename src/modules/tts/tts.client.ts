import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { AudioLivePlayer } from '~/common/util/audio/AudioLivePlayer';
import { AudioPlayer } from '~/common/util/audio/AudioPlayer';
import { convert_Base64_To_UInt8Array } from '~/common/util/blobUtils';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { SystemPurposes, type SystemPurposeId } from '~/data';

import { findTTSVendor } from './vendors.registry';
import { getActiveTTSService, getTTSService, useTTSStore } from './store-tts.ts';
import type { TTSGenerationOptions, TTSSpeakResult, TTSServiceId } from './tts.types';


/**
 * Get persona-specific TTS configuration
 */
function getPersonaTTSConfig(personaId?: SystemPurposeId): { serviceId?: TTSServiceId; voiceId?: string } | null {
  if (!personaId) return null;

  const persona = SystemPurposes[personaId];
  if (!persona?.voices) return null;

  // Check new tts field first
  if (persona.voices.tts?.voiceId) {
    return {
      voiceId: persona.voices.tts.voiceId,
    };
  }

  // Fall back to legacy elevenLabs field for backward compatibility
  if (persona.voices.elevenLabs?.voiceId) {
    return {
      voiceId: persona.voices.elevenLabs.voiceId,
    };
  }

  return null;
}


/**
 * Main TTS invocation function - vendor-agnostic
 * Speaks text using the configured TTS service
 */
export async function speakText(
  text: string,
  options?: {
    serviceId?: TTSServiceId;  // Override global service
    voiceId?: string;          // Override global voice
    personaId?: SystemPurposeId; // Use persona's voice preference
    streaming?: boolean;
    turbo?: boolean;
    speed?: number;
  },
): Promise<TTSSpeakResult> {
  // Early validation
  if (!text?.trim()) {
    return { success: false };
  }

  // 1. Resolve service
  const { services, activeServiceId, activeVoiceId } = useTTSStore.getState();

  let serviceId = options?.serviceId;
  let voiceId = options?.voiceId;

  // Check persona configuration
  if (options?.personaId) {
    const personaConfig = getPersonaTTSConfig(options.personaId);
    if (personaConfig) {
      serviceId = personaConfig.serviceId || serviceId;
      voiceId = personaConfig.voiceId || voiceId;
    }
  }

  // Fall back to global defaults
  serviceId = serviceId || activeServiceId || undefined;
  voiceId = voiceId || activeVoiceId || undefined;

  if (!serviceId) {
    console.warn('TTS: No service configured');
    return { success: false };
  }

  const service = getTTSService(serviceId);
  if (!service) {
    console.warn('TTS: Service not found:', serviceId);
    return { success: false };
  }

  // 2. Get vendor implementation
  const vendor = findTTSVendor(service.vId);
  if (!vendor) {
    console.warn('TTS: Vendor not found:', service.vId);
    return { success: false };
  }

  // 3. Get transport access
  const access = vendor.getTransportAccess(service.setup);

  // 4. Prepare generation options
  const { preferredLanguage } = useUIPreferencesStore.getState();
  const nonEnglish = !(preferredLanguage?.toLowerCase()?.startsWith('en'));

  const generationOptions: TTSGenerationOptions = {
    text,
    voiceId,
    streaming: options?.streaming ?? false,
    turbo: options?.turbo ?? false,
    speed: options?.speed,
    nonEnglish,
  };

  // 5. Execute TTS
  try {
    const stream = await vendor.rpcSpeak(access, generationOptions);

    let liveAudioPlayer: AudioLivePlayer | undefined;
    let playbackStarted = false;
    let audioBase64: string | undefined;

    for await (const piece of stream) {
      // Streaming audio chunk
      if (piece.audioChunk) {
        try {
          if (!liveAudioPlayer) {
            liveAudioPlayer = new AudioLivePlayer();
          }

          const chunkArray = convert_Base64_To_UInt8Array(piece.audioChunk.base64, 'tts.client (chunk)');
          liveAudioPlayer.enqueueChunk(chunkArray.buffer);
          playbackStarted = true;
        } catch (audioError) {
          console.error('TTS audio chunk error:', audioError);
          return { success: false };
        }
      }

      // Full audio buffer
      else if (piece.audio) {
        try {
          if (!options?.streaming) {
            audioBase64 = piece.audio.base64;
          }

          const audioArray = convert_Base64_To_UInt8Array(piece.audio.base64, 'tts.client');
          void AudioPlayer.playBuffer(audioArray.buffer);
          playbackStarted = true;
        } catch (audioError) {
          console.error('TTS audio buffer error:', audioError);
          return { success: false };
        }
      }

      // Errors
      else if (piece.errorMessage) {
        console.error('TTS error:', piece.errorMessage);
        return { success: false, error: piece.errorMessage };
      } else if (piece.warningMessage) {
        console.warn('TTS warning:', piece.warningMessage);
      } else if (piece.control === 'start' || piece.control === 'end') {
        // Control messages - continue processing
      }
    }

    return { success: playbackStarted, audioBase64 };
  } catch (error) {
    console.error('TTS playback error:', error);
    return { success: false, error: String(error) };
  }
}


/**
 * Check if TTS is available and configured
 */
export function isTTSAvailable(): boolean {
  const { services, activeServiceId } = useTTSStore.getState();

  // Check if we have an active service
  if (activeServiceId) {
    const service = services.find(s => s.id === activeServiceId);
    if (service) {
      const vendor = findTTSVendor(service.vId);
      if (vendor?.validateSetup?.(service.setup) !== false) {
        return true;
      }
    }
  }

  // Check backend capabilities for server-side TTS
  const caps = getBackendCapabilities();
  return caps.hasVoiceElevenLabs;
}
