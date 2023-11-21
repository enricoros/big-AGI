import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';


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

export const useElevenLabsApiKey = (): [string, (apiKey: string) => void] =>
  useElevenlabsStore(state => [state.elevenLabsApiKey, state.setElevenLabsApiKey], shallow);

export const useElevenLabsVoiceId = (): [string, (voiceId: string) => void] =>
  useElevenlabsStore(state => [state.elevenLabsVoiceId, state.setElevenLabsVoiceId], shallow);

export const useElevenLabsData = (): [string, string] =>
  useElevenlabsStore(state => [state.elevenLabsApiKey, state.elevenLabsVoiceId], shallow);

export const getElevenLabsData = (): { elevenLabsApiKey: string, elevenLabsVoiceId: string } =>
  useElevenlabsStore.getState();
