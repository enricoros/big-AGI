import { ElevenLabs } from './elevenlabs.types';
import { useSettingsStore } from '@/common/state/store-settings';


export const requireUserKeyElevenLabs = !process.env.HAS_SERVER_KEY_ELEVENLABS;

export const isValidElevenLabsApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 32;


export async function speakText(text: string) {
  if (!(text?.trim())) return;

  const { elevenLabsApiKey, elevenLabsVoiceId } = useSettingsStore.getState();

  try {
    // NOTE: hardcoded 1000 as a failsafe, since the API will take very long and consume lots of credits for longer texts
    const audioBuffer = await callElevenlabsSpeech(text.slice(0, 1000), elevenLabsApiKey, elevenLabsVoiceId);
    const audioContext = new AudioContext();
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = await audioContext.decodeAudioData(audioBuffer);
    bufferSource.connect(audioContext.destination);
    bufferSource.start();
  } catch (error) {
    console.error('Error playing first text:', error);
  }
}


async function callElevenlabsSpeech(text: string, elevenLabsApiKey: string, elevenLabsVoiceId: string): Promise<ArrayBuffer> {
  const payload: ElevenLabs.API.TextToSpeech.RequestBody = {
    apiKey: elevenLabsApiKey,
    text,
    voiceId: elevenLabsVoiceId,
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
