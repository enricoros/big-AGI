import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { AudioLivePlayer } from '~/common/util/audio/AudioLivePlayer';
import { AudioPlayer } from '~/common/util/audio/AudioPlayer';
import { CapabilityElevenLabsSpeechSynthesis } from '~/common/components/useCapabilities';
import { apiStream } from '~/common/util/trpc.client';
import { convert_Base64_To_UInt8Array } from '~/common/util/blobUtils';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { getElevenLabsData, useElevenLabsData } from './store-module-elevenlabs';


export const isValidElevenLabsApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 32;

export const isElevenLabsEnabled = (apiKey?: string) => apiKey
  ? isValidElevenLabsApiKey(apiKey)
  : getBackendCapabilities().hasVoiceElevenLabs;


export function useCapability(): CapabilityElevenLabsSpeechSynthesis {
  const [clientApiKey, voiceId] = useElevenLabsData();
  const isConfiguredServerSide = getBackendCapabilities().hasVoiceElevenLabs;
  const isConfiguredClientSide = clientApiKey ? isValidElevenLabsApiKey(clientApiKey) : false;
  const mayWork = isConfiguredServerSide || isConfiguredClientSide || !!voiceId;
  return { mayWork, isConfiguredServerSide, isConfiguredClientSide };
}


export async function elevenLabsSpeakText(text: string, voiceId: string | undefined, audioStreaming: boolean, audioTurbo: boolean) {
  if (!(text?.trim())) return;

  const { elevenLabsApiKey, elevenLabsVoiceId } = getElevenLabsData();
  if (!isElevenLabsEnabled(elevenLabsApiKey)) return;

  const { preferredLanguage } = useUIPreferencesStore.getState();
  const nonEnglish = !(preferredLanguage?.toLowerCase()?.startsWith('en'));

  // audio live player instance, if needed
  let liveAudioPlayer: AudioLivePlayer | undefined;

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
      if (piece.audioChunk) {

        // create the live audio player as needed
        // NOTE: in the future we can have a centralized audio playing system
        if (!liveAudioPlayer)
          liveAudioPlayer = new AudioLivePlayer();

        // enqueue a decoded audio chunk - this will throw on malformed base64 data
        const chunkArray = convert_Base64_To_UInt8Array(piece.audioChunk.base64, 'elevenLabsSpeakText (chunk)')
        liveAudioPlayer.enqueueChunk(chunkArray.buffer);

      } else if (piece.audio) {

        // also consider merging LiveAudioPlayer into AudioPlayer - note this will throw on malformed base64 data
        const audioArray = convert_Base64_To_UInt8Array(piece.audio.base64, 'elevenLabsSpeakText');
        void AudioPlayer.playBuffer(audioArray.buffer); // fire/forget - it's a single piece of audio (could be long tho)

      } else if (piece.errorMessage)
        console.log('ElevenLabs issue:', piece.errorMessage);
      else if (piece.warningMessage)
        console.log('ElevenLabs warning:', piece.errorMessage);
      else if (piece.control === 'start' || piece.control === 'end') {
        // ignore..
      } else
        console.log('piece:', piece);
    }

  } catch (error) {
    console.error('Error playing first text:', error);
  }
}
