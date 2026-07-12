import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// NOTE: starter set of image generation models available through the OpenRouter
//       dedicated image API (POST /api/v1/images). The full list is at
//       https://openrouter.ai/models?fmt=cards&output_modalities=image

export const OPENROUTER_IMAGE_MODELS: { value: string, label: string }[] = [
  { value: 'google/gemini-3-pro-image', label: 'Gemini 3 Pro Image (Nano Banana Pro)' },
  { value: 'google/gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image' },
  { value: 'google/gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (Nano Banana)' },
  { value: 'openai/gpt-image-2', label: 'GPT Image 2' },
  { value: 'openai/gpt-image-1-mini', label: 'GPT Image 1 Mini' },
  { value: 'black-forest-labs/flux.2-max', label: 'FLUX.2 Max' },
  { value: 'black-forest-labs/flux.2-pro', label: 'FLUX.2 Pro' },
  { value: 'bytedance-seed/seedream-4.5', label: 'Seedream 4.5' },
  { value: 'microsoft/mai-image-2.5', label: 'MAI Image 2.5' },
  { value: 'recraft/recraft-v4', label: 'Recraft V4' },
  { value: 'sourceful/riverflow-v2.5-pro', label: 'Riverflow V2.5 Pro' },
];

export const OPENROUTER_DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image';


export function openRouterImageModelLabel(modelId: string): string {
  return OPENROUTER_IMAGE_MODELS.find(m => m.value === modelId)?.label || modelId;
}


interface ModuleOpenRouterT2IStore {

  orImageModelId: string;
  setOrImageModelId: (modelId: string) => void;

}

export const useOpenRouterT2IStore = create<ModuleOpenRouterT2IStore>()(
  persist(
    (set) => ({

      orImageModelId: OPENROUTER_DEFAULT_IMAGE_MODEL,
      setOrImageModelId: (orImageModelId) => set({ orImageModelId }),

    }),
    {
      name: 'app-module-openrouter-t2i',
      version: 1,
    },
  ),
);
