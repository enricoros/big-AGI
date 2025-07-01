import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PRODIA_HARDCODED_MODELS } from '~/modules/t2i/prodia/prodia.models';


export const DEFAULT_PRODIA_RESOLUTION = '1024x1024';
export const HARDCODED_PRODIA_RESOLUTIONS: string[] = [
  '512x512',
  '768x768',
  '1024x1024',
  '1152x896',
  '768x1344',
  '1344x768',
];


interface ModuleProdiaStore {

  apiKey: string;
  setApiKey: (apiKey: string) => void;

  modelId: string;
  setModelId: (modelId: string) => void;

  resolution: string;
  setResolution: (resolution: string) => void;

  negativePrompt: string;
  setNegativePrompt: (negativePrompt: string) => void;

  fluxSteps: number;
  setFluxSteps: (fluxSteps: number) => void;

  sdxlSteps: number;
  setSdxlSteps: (sdxlSteps: number) => void;

  sdCfgScale: number;
  setSdCfgScale: (sdCfgScale: number) => void;

  stylePreset: string | null;
  setStylePreset: (stylePreset: string | null) => void;

  seed: number | null;
  setSeed: (seed: string) => void;

}

export const useProdiaStore = create<ModuleProdiaStore>()(
  persist(
    (set) => ({

      apiKey: '',
      setApiKey: (apiKey) => set({ apiKey }),

      modelId: PRODIA_HARDCODED_MODELS[0].id,
      setModelId: (modelId) => set({ modelId }),

      resolution: DEFAULT_PRODIA_RESOLUTION,
      setResolution: (resolution) => set({ resolution }),

      negativePrompt: '',
      setNegativePrompt: (negativePrompt) => set({ negativePrompt }),

      fluxSteps: 2,
      setFluxSteps: (steps) => set({ fluxSteps: steps }),

      sdxlSteps: 20,
      setSdxlSteps: (steps) => set({ sdxlSteps: steps }),

      sdCfgScale: 7,
      setSdCfgScale: (sdCfgScale) => set({ sdCfgScale }),

      stylePreset: null,
      setStylePreset: (stylePreset) => set({ stylePreset }),

      seed: null,
      setSeed: (seed) => set({
        seed: (seed === '' || seed === '-1') ? null : parseInt(seed) ?? null,
      }),

    }),
    {
      name: 'app-module-prodia-v2',
    },
  ),
);