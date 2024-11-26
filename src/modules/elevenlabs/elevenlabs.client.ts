import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { AudioLivePlayer } from '~/common/util/audio/AudioLivePlayer';
import { AudioPlayer } from '~/common/util/audio/AudioPlayer';
import { CapabilityElevenLabsSpeechSynthesis } from '~/common/components/useCapabilities';
import { apiStream } from '~/common/util/trpc.client';
import { base64ToArrayBuffer } from '~/common/util/urlUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';

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

        const chunkBuffer = base64ToArrayBuffer(piece.audioChunk.base64);
        liveAudioPlayer.enqueueChunk(chunkBuffer);

      } else if (piece.audio) {

        // also consieder mergin LiveAudioPlayer into AudioPlayer
        void AudioPlayer.playBuffer(base64ToArrayBuffer(piece.audio.base64)); // fire/forget - it's a single piece of audio (could be long tho)

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
