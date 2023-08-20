import { LiveAudioPlayer, playSoundBuffer } from '~/common/util/audioUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import type { SpeechInputSchema } from './elevenlabs.router';
import { useElevenlabsStore } from './store-elevenlabs';


export const requireUserKeyElevenLabs = !process.env.HAS_SERVER_KEY_ELEVENLABS;

export const canUseElevenLabs = (): boolean => !!useElevenlabsStore.getState().elevenLabsVoiceId || !requireUserKeyElevenLabs;

export const isValidElevenLabsApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 32;

export const isElevenLabsEnabled = (apiKey?: string) => apiKey ? isValidElevenLabsApiKey(apiKey) : !requireUserKeyElevenLabs;


export async function speakText(text: string, voiceId?: string) {
  if (!(text?.trim())) return;

  const { elevenLabsApiKey, elevenLabsVoiceId } = useElevenlabsStore.getState();
  if (!isElevenLabsEnabled(elevenLabsApiKey)) return;

  const { preferredLanguage } = useUIPreferencesStore.getState();
  const nonEnglish = !(preferredLanguage?.toLowerCase()?.startsWith('en'));

  try {
    const edgeResponse = await fetchApiElevenlabsSpeech(text, elevenLabsApiKey, voiceId || elevenLabsVoiceId, nonEnglish, false);
    const audioBuffer = await edgeResponse.arrayBuffer();
    await playSoundBuffer(audioBuffer);
  } catch (error) {
    console.error('Error playing first text:', error);
  }
}

// let liveAudioPlayer: LiveAudioPlayer | undefined = undefined;

export async function EXPERIMENTAL_speakTextStream(text: string, voiceId?: string) {
  if (!(text?.trim())) return;

  const { elevenLabsApiKey, elevenLabsVoiceId } = useElevenlabsStore.getState();
  if (!isElevenLabsEnabled(elevenLabsApiKey)) return;

  const { preferredLanguage } = useUIPreferencesStore.getState();
  const nonEnglish = !(preferredLanguage?.toLowerCase()?.startsWith('en'));

  const edgeResponse = await fetchApiElevenlabsSpeech(text, elevenLabsApiKey, voiceId || elevenLabsVoiceId, nonEnglish, true);

  // if (!liveAudioPlayer)
  const liveAudioPlayer = new LiveAudioPlayer();
  liveAudioPlayer.EXPERIMENTAL_playStream(edgeResponse).then();
}


/**
 * Note: we have to use this client-side API instead of TRPC because of ArrayBuffers..
 */
async function fetchApiElevenlabsSpeech(text: string, elevenLabsApiKey: string, elevenLabsVoiceId: string, nonEnglish: boolean, streaming: boolean): Promise<Response> {
  // NOTE: hardcoded 1000 as a failsafe, since the API will take very long and consume lots of credits for longer texts
  const speechInput: SpeechInputSchema = {
    elevenKey: elevenLabsApiKey,
    text: text.slice(0, 1000),
    voiceId: elevenLabsVoiceId,
    nonEnglish,
    ...(streaming && { streaming: true, streamOptimization: 4 }),
  };

  const response = await fetch('/api/elevenlabs/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(speechInput),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || errorData.message || 'Unknown error');
  }

  return response;
}