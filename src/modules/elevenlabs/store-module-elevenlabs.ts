import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';


interface ModuleElevenlabsStore {

  // ElevenLabs Text to Speech settings

  elevenLabsApiKey: string;
  setElevenLabsApiKey: (apiKey: string) => void;

  elevenLabsVoiceId: string;
  setElevenLabsVoiceId: (voiceId: string) => void;

}

const useElevenlabsStore = create<ModuleElevenlabsStore>()(
  persist(
    (set) => ({

      // ElevenLabs Text to Speech settings

      elevenLabsApiKey: '',
      setElevenLabsApiKey: (elevenLabsApiKey: string) => set({ elevenLabsApiKey }),

      elevenLabsVoiceId: '',
      setElevenLabsVoiceId: (elevenLabsVoiceId: string) => set({ elevenLabsVoiceId }),

    }),
    {
      name: 'app-module-elevenlabs',
    }),
);

export const useElevenLabsApiKey = (): [string, (apiKey: string) => void] => {
  const apiKey = useElevenlabsStore(state => state.elevenLabsApiKey);
  return [apiKey, useElevenlabsStore.getState().setElevenLabsApiKey];
};

export const useElevenLabsVoiceId = (): [string, (voiceId: string) => void] => {
  const voiceId = useElevenlabsStore(state => state.elevenLabsVoiceId);
  return [voiceId, useElevenlabsStore.getState().setElevenLabsVoiceId];
};

export const useElevenLabsData = (): [string, string] =>
  useElevenlabsStore(useShallow(state => [state.elevenLabsApiKey, state.elevenLabsVoiceId]));

export const getElevenLabsData = (): { elevenLabsApiKey: string, elevenLabsVoiceId: string } =>
  useElevenlabsStore.getState();
