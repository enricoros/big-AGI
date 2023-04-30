import { ElevenLabs } from './elevenlabs.types';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@/common/state/store-settings';


export const requireUserKeyElevenLabs = !process.env.HAS_SERVER_KEY_ELEVENLABS;

export const isValidElevenLabsApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 32;


export async function speakText(text: string) {
  if (!(text?.trim())) return;

  const { elevenLabsApiKey, elevenLabsVoiceId, preferredLanguage } = useSettingsStore.getState();
  try {
    // NOTE: hardcoded 1000 as a failsafe, since the API will take very long and consume lots of credits for longer texts
    const nonEnglish = !(preferredLanguage.toLowerCase().startsWith('en'));
    const audioBuffer = await callElevenlabsSpeech(text.slice(0, 1000), elevenLabsApiKey, elevenLabsVoiceId, nonEnglish);
    const audioContext = new AudioContext();
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = await audioContext.decodeAudioData(audioBuffer);
    bufferSource.connect(audioContext.destination);
    bufferSource.start();
  } catch (error) {
    console.error('Error playing first text:', error);
  }
}


async function callElevenlabsSpeech(text: string, elevenLabsApiKey: string, elevenLabsVoiceId: string, nonEnglish: boolean): Promise<ArrayBuffer> {
  const payload: ElevenLabs.API.TextToSpeech.RequestBody = {
    apiKey: elevenLabsApiKey,
    text,
    voiceId: elevenLabsVoiceId,
    nonEnglish,
  };

  const response = await fetch('/api/elevenlabs/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || errorData.message || 'Unknown error');
  }

  return await response.arrayBuffer();
}


export function useElevenLabsVoices(apiKey: string, isEnabled: boolean) {
  const { data: voicesData, isLoading: loadingVoices } = useQuery(['elevenlabs-voices', apiKey], {
    enabled: isEnabled,
    queryFn: () => fetch('/api/elevenlabs/voices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(apiKey ? { apiKey } : {}) }),
    }).then(res => res.json() as Promise<ElevenLabs.API.Voices.Response>),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  return { voicesData, loadingVoices };
}
