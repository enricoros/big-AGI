import { create } from 'zustand';
import { persist } from 'zustand/middleware';


interface ElevenlabsStore {

  // ElevenLabs Text to Speech settings

  elevenLabsApiKey: string;
  setElevenLabsApiKey: (apiKey: string) => void;

  elevenLabsVoiceId: string;
  setElevenLabsVoiceId: (voiceId: string) => void;

  elevenLabsAutoSpeak: 'off' | 'firstLine';
  setElevenLabsAutoSpeak: (autoSpeak: 'off' | 'firstLine') => void;

}

export const useElevenlabsStore = create<ElevenlabsStore>()(
  persist(
    (set) => ({

      // ElevenLabs Text to Speech settings

      elevenLabsApiKey: '',
      setElevenLabsApiKey: (elevenLabsApiKey: string) => set({ elevenLabsApiKey }),

      elevenLabsVoiceId: '',
      setElevenLabsVoiceId: (elevenLabsVoiceId: string) => set({ elevenLabsVoiceId }),

      elevenLabsAutoSpeak: 'off',
      setElevenLabsAutoSpeak: (elevenLabsAutoSpeak: 'off' | 'firstLine') => set({ elevenLabsAutoSpeak }),

    }),
    {
      name: 'app-module-elevenlabs',
    }),
);