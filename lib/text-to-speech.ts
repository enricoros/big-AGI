import { ElevenLabs } from '@/types/api-elevenlabs';
import { useSettingsStore } from '@/lib/store-settings';

// const audioCache: Record<string, ArrayBuffer> = {};
//
// function createCacheKey(text: string, voiceId: string): string {
//   const hash = (str: string) => {
//     let h = 0;
//     for (let i = 0; i < str.length; i++) {
//       h = Math.imul(31, h) + str.charCodeAt(i) | 0;
//     }
//     return h;
//   };
//
//   return `${hash(text)}-${hash(voiceId)}`;
// }

export async function speakIfFirstLine(text: string) {
  if (useSettingsStore.getState().elevenLabsAutoSpeak === 'firstLine')
    await speakText(text);
}

export async function speakText(text: string) {
  if (!(text?.trim())) return;

  const { elevenLabsApiKey, elevenLabsVoiceId } = useSettingsStore.getState();

  try {
    // const cacheKey = createCacheKey(text, elevenLabsVoiceId);
    // if (!audioCache[cacheKey])
    //   audioCache[cacheKey] = await convertTextToSpeech(text, elevenLabsApiKey, elevenLabsVoiceId);
    // const audioBuffer = audioCache[cacheKey];

    // NOTE: hardcoded 1000 as a failsafe, since the API will take very long and consume lots of credits for longer texts
    const audioBuffer = await convertTextToSpeech(text.slice(0, 1000), elevenLabsApiKey, elevenLabsVoiceId);
    const audioContext = new AudioContext();
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = await audioContext.decodeAudioData(audioBuffer);
    bufferSource.connect(audioContext.destination);
    bufferSource.start();
  } catch (error) {
    console.error('Error playing first text:', error);
  }
}


async function convertTextToSpeech(text: string, elevenLabsApiKey: string, elevenLabsVoiceId: string): Promise<ArrayBuffer> {
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