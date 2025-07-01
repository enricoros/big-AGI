import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { AudioLivePlayer } from '~/common/util/audio/AudioLivePlayer';
import { AudioPlayer } from '~/common/util/audio/AudioPlayer';
import { CapabilityElevenLabsSpeechSynthesis } from '~/common/components/useCapabilities';
import { apiStream } from '~/common/util/trpc.client';
import { convert_Base64_To_UInt8Array } from '~/common/util/blobUtils';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { getElevenLabsData, useElevenLabsData } from './store-module-elevenlabs';


export const isValidElevenLabsApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 32;

export const isElevenLabsEnabled = (apiKey?: string) =>
  apiKey ? isValidElevenLabsApiKey(apiKey)
    : getBackendCapabilities().hasVoiceElevenLabs;


export function useCapability(): CapabilityElevenLabsSpeechSynthesis {
  const [clientApiKey, voiceId] = useElevenLabsData();
  const isConfiguredServerSide = getBackendCapabilities().hasVoiceElevenLabs;
  const isConfiguredClientSide = clientApiKey ? isValidElevenLabsApiKey(clientApiKey) : false;
  const mayWork = isConfiguredServerSide || isConfiguredClientSide || !!voiceId;
  return { mayWork, isConfiguredServerSide, isConfiguredClientSide };
}


interface ElevenLabsSpeakResult {
  success: boolean;
  audioBase64?: string; // Available when not streaming
}


/**
 * Speaks text using ElevenLabs TTS
 * @returns Object with success status and optionally the audio base64 (when not streaming)
 */
export async function elevenLabsSpeakText(text: string, voiceId: string | undefined, audioStreaming: boolean, audioTurbo: boolean): Promise<ElevenLabsSpeakResult> {
  // Early validation
  if (!(text?.trim())) {
    // console.log('ElevenLabs: No text to speak');
    return { success: false };
  }

  const { elevenLabsApiKey, elevenLabsVoiceId } = getElevenLabsData();
  if (!isElevenLabsEnabled(elevenLabsApiKey)) {
    // console.warn('ElevenLabs: Service not enabled or configured');
    return { success: false };
  }

  const { preferredLanguage } = useUIPreferencesStore.getState();
  const nonEnglish = !(preferredLanguage?.toLowerCase()?.startsWith('en'));

  // audio live player instance, if needed
  let liveAudioPlayer: AudioLivePlayer | undefined;
  let playbackStarted = false;
  let audioBase64: string | undefined;

  try {

    const stream = await apiStream.elevenlabs.speech.mutate({
      xiKey: elevenLabsApiKey,
      voiceId: voiceId || elevenLabsVoiceId,
      text: text,
      nonEnglish,
      audioStreaming,
      audioTurbo,
    });

    for await (const piece of stream) {

      // ElevenLabs stream buffer
      if (piece.audioChunk) {
        try {
          // create the live audio player as needed
          // NOTE: in the future we can have a centralized audio playing system
          if (!liveAudioPlayer)
            liveAudioPlayer = new AudioLivePlayer();

          // enqueue a decoded audio chunk - this will throw on malformed base64 data
          const chunkArray = convert_Base64_To_UInt8Array(piece.audioChunk.base64, 'elevenLabsSpeakText (chunk)');
          liveAudioPlayer.enqueueChunk(chunkArray.buffer);
          playbackStarted = true;
        } catch (audioError) {
          console.error('ElevenLabs audio chunk error:', audioError);
          return { success: false };
        }
      }

      // ElevenLabs full audio buffer
      else if (piece.audio) {
        try {
          // return base64 for potential reuse
          if (!audioStreaming)
            audioBase64 = piece.audio.base64;

          // also consider merging LiveAudioPlayer into AudioPlayer - note this will throw on malformed base64 data
          const audioArray = convert_Base64_To_UInt8Array(piece.audio.base64, 'elevenLabsSpeakText');
          void AudioPlayer.playBuffer(audioArray.buffer); // fire/forget - it's a single piece of audio (could be long tho)
          playbackStarted = true;
        } catch (audioError) {
          console.error('ElevenLabs audio buffer error:', audioError);
          return { success: false };
        }
      }

      // Errors
      else if (piece.errorMessage) {
        console.error('ElevenLabs error:', piece.errorMessage);
        return { success: false };
      } else if (piece.warningMessage) {
        console.warn('ElevenLabs warning:', piece.warningMessage);
        // Continue processing warnings
      } else if (piece.control === 'start' || piece.control === 'end') {
        // Control messages - continue processing
      } else {
        console.log('ElevenLabs unknown piece:', piece);
      }
    }
    return { success: playbackStarted, audioBase64 };
  } catch (error) {
    console.error('ElevenLabs playback error:', error);
    return { success: false };
  }
}
