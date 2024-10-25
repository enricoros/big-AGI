import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type TTSEngineKey = 'elevenlabs' | 'webspeech';

export const TTSEngineList: { key: TTSEngineKey; label: string }[] = [
  {
    key: 'elevenlabs',
    label: 'ElevenLabs',
  },
  {
    key: 'webspeech',
    label: 'Web Speech API',
  },
];

interface TTSStore {
  TTSEngine: TTSEngineKey;
  setTTSEngine: (TTSEngine: TTSEngineKey) => void;
}

const useTTSStore = create<TTSStore>()(
  persist(
    (_set, _get) => ({
      TTSEngine: TTSEngineList[0].key,
      setTTSEngine: (TTSEngine: TTSEngineKey) => _set({ TTSEngine }),
    }),
    { name: 'tts' },
  ),
);

export const useTTSEngine = (): [TTSEngineKey, (TTSEngine: TTSEngineKey) => void] => useTTSStore(useShallow((state) => [state.TTSEngine, state.setTTSEngine]));
export const getTTSEngine = () => useTTSStore.getState().TTSEngine;
