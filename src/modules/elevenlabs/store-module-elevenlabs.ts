import { create } from 'zustand';
import { persist } from 'zustand/middleware';


interface ModuleElevenlabsStore {

  // ElevenLabs Text to Speech settings

  elevenLabsApiKey: string;
  setElevenLabsApiKey: (apiKey: string) => void;

  elevenLabsVoiceId: string;
  setElevenLabsVoiceId: (voiceId: string) => void;

  elevenLabsAutoSpeak: 'off' | 'firstLine';
  setElevenLabsAutoSpeak: (autoSpeak: 'off' | 'firstLine') => void;

}

export const useModuleElevenlabsStore = create<ModuleElevenlabsStore>()(
  persist(
    (set) => ({

      // ElevenLabs Text to Speech settings

      elevenLabsApiKey: '',
      setElevenLabsApiKey: (elevenLabsApiKey: string) => set({ elevenLabsApiKey }),

      elevenLabsVoiceId: '',
      setElevenLabsVoiceId: (elevenLabsVoiceId: string) => set({ elevenLabsVoiceId }),

      elevenLabsAutoSpeak: 'firstLine',
      setElevenLabsAutoSpeak: (elevenLabsAutoSpeak: 'off' | 'firstLine') => set({ elevenLabsAutoSpeak }),

    }),
    {
      name: 'app-module-elevenlabs',
    }),
);