import { create } from 'zustand';
import { persist } from 'zustand/middleware';


export type DalleImageSize = '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
export const DALLE_DEFAULT_IMAGE_SIZE: DalleImageSize = '1024x1024';


interface ModuleDalleStore {

  // Dalle Image Generation settings

  dalleModelId: 'dall-e-3' | 'dall-e-2',
  setDalleModelId: (modelId: 'dall-e-3' | 'dall-e-2') => void;

  dalleQuality: 'standard' | 'hd',
  setDalleQuality: (quality: 'standard' | 'hd') => void;

  dalleSize: DalleImageSize,
  setDalleSize: (size: DalleImageSize) => void;

  dalleStyle: 'vivid' | 'natural';
  setDalleStyle: (style: 'vivid' | 'natural') => void;

  dalleNoRewrite: boolean;
  setDalleNoRewrite: (noRewrite: boolean) => void;

}

export const useDalleStore = create<ModuleDalleStore>()(
  persist(
    (set) => ({

      // Dalle Image Generation settings

      dalleModelId: 'dall-e-3',
      setDalleModelId: (dalleModelId: 'dall-e-3' | 'dall-e-2') => set({ dalleModelId }),

      dalleQuality: 'standard',
      setDalleQuality: (dalleQuality: 'standard' | 'hd') => set({ dalleQuality }),

      dalleSize: DALLE_DEFAULT_IMAGE_SIZE,
      setDalleSize: (dalleSize: DalleImageSize) => set({ dalleSize }),

      dalleStyle: 'vivid',
      setDalleStyle: (dalleStyle: 'vivid' | 'natural') => set({ dalleStyle }),

      dalleNoRewrite: false,
      setDalleNoRewrite: (dalleNoRewrite: boolean) => set({ dalleNoRewrite }),

    }),
    {
      name: 'app-module-dalle',
    },
  ),
);