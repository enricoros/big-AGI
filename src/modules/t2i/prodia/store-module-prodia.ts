import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// These work good for SDXL models, from: https://docs.prodia.com/reference/sdxl-generate
export const HARDCODED_PRODIA_RESOLUTIONS: string[] = ['1024x1024', '1152x896', '1216x832', '1344x768', '1536x640', '640x1536', '768x1344', '832x1216'];
export const DEFAULT_PRODIA_RESOLUTION = HARDCODED_PRODIA_RESOLUTIONS[0];


interface ModuleProdiaStore {

  // Prodia Image Generation settings

  prodiaApiKey: string;
  setProdiaApiKey: (apiKey: string) => void;

  prodiaModelId: string;
  setProdiaModelId: (modelId: string) => void;

  prodiaModelGen: 'sd' | 'sdxl';
  setProdiaModelGen: (modelGen: 'sd' | 'sdxl') => void;

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

  prodiaResolution: string,
  setProdiaResolution: (resolution: string) => void;

  prodiaSeed: number | null;
  setProdiaSeed: (seed: string) => void;

}

export const useProdiaStore = create<ModuleProdiaStore>()(
  persist(
    (set) => ({

      // Prodia Image Generation settings

      prodiaApiKey: '',
      setProdiaApiKey: (prodiaApiKey: string) => set({ prodiaApiKey }),

      prodiaModelId: '',
      setProdiaModelId: (prodiaModelId: string) => set({ prodiaModelId }),

      prodiaModelGen: 'sd',
      setProdiaModelGen: (prodiaModelGen: 'sd' | 'sdxl') => set({ prodiaModelGen }),

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

      prodiaResolution: DEFAULT_PRODIA_RESOLUTION,
      setProdiaResolution: (prodiaResolution: string) => set({ prodiaResolution }),

      prodiaSeed: null,
      setProdiaSeed: (prodiaSeed: string) => set({ prodiaSeed: (prodiaSeed === '' || prodiaSeed === '-1') ? null : parseInt(prodiaSeed) ?? null }),

    }),
    {
      name: 'app-module-prodia',
      /* Version history:
       * 2: [2023-10-27] Add SDXL support (prodiaModelGen, prodiaResolution)
       */
      version: 2,
    },
  ),
);