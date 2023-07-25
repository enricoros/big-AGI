import { create } from 'zustand';
import { persist } from 'zustand/middleware';


interface ProdiaStore {

  // Prodia Image Generation settings

  prodiaApiKey: string;
  setProdiaApiKey: (apiKey: string) => void;

  prodiaModelId: string;
  setProdiaModelId: (modelId: string) => void;

  prodiaNegativePrompt: string;
  setProdiaNegativePrompt: (negativePrompt: string) => void;

  prodiaSteps: number;
  setProdiaSteps: (steps: number) => void;

  prodiaCfgScale: number;
  setProdiaCfgScale: (cfgScale: number) => void;

  prodiaAspectRatio: 'square' | 'portrait' | 'landscape';
  setProdiaAspectRatio: (aspectRatio: 'square' | 'portrait' | 'landscape') => void;

  prodiaUpscale: boolean;
  setProdiaUpscale: (upscale: boolean) => void;

  prodiaSeed: number | null;
  setProdiaSeed: (seed: string) => void;

}

export const useProdiaStore = create<ProdiaStore>()(
  persist(
    (set) => ({

      // Prodia Image Generation settings

      prodiaApiKey: '',
      setProdiaApiKey: (prodiaApiKey: string) => set({ prodiaApiKey }),

      prodiaModelId: '',
      setProdiaModelId: (prodiaModelId: string) => set({ prodiaModelId }),

      prodiaNegativePrompt: '',
      setProdiaNegativePrompt: (prodiaNegativePrompt: string) => set({ prodiaNegativePrompt }),

      prodiaSteps: 25,
      setProdiaSteps: (prodiaSteps: number) => set({ prodiaSteps }),

      prodiaCfgScale: 7,
      setProdiaCfgScale: (prodiaCfgScale: number) => set({ prodiaCfgScale }),

      prodiaAspectRatio: 'square',
      setProdiaAspectRatio: (prodiaAspectRatio: 'square' | 'portrait' | 'landscape') => set({ prodiaAspectRatio }),

      prodiaUpscale: false,
      setProdiaUpscale: (prodiaUpscale: boolean) => set({ prodiaUpscale }),

      prodiaSeed: null,
      setProdiaSeed: (prodiaSeed: string) => set({ prodiaSeed: (prodiaSeed === '' || prodiaSeed === '-1') ? null : parseInt(prodiaSeed) ?? null }),

    }),
    {
      name: 'app-module-prodia',
    }),
);