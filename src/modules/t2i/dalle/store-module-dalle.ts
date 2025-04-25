import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// NOTE: keep all the following type definitions in sync with the server-side
//       router types, in `openai.router.ts`, which in turn is a
//       strict subset of OpenAIWire_API_Images_Generations.Request


export const DALLE_DEFAULT_IMAGE_SIZE: DalleImageSize = '1024x1024'; // this works in all
export type DalleImageSize = DalleSizeGI | DalleSizeD3 | DalleSizeD2;

export type DalleModelId = 'gpt-image-1' | 'dall-e-3' | 'dall-e-2';

export type DalleImageQuality = DalleImageQualityGI | DalleImageQualityD3;
type DalleImageQualityGI = 'high' | 'medium' | 'low'; // gpt-image-1
type DalleImageQualityD3 = 'hd' | 'standard'; // DALL-E 3

type DalleImageStyleD3 = 'vivid' | 'natural';

type DalleBackgroundGI = 'auto' | 'transparent' | 'opaque';
type DalleOutputFormatGI = 'png' | 'jpeg' | 'webp';
type DalleModerationGI = 'auto' | 'low';

export type DalleSize = DalleSizeGI | DalleSizeD3 | DalleSizeD2;
export type DalleSizeGI = '1024x1024' | '1536x1024' | '1024x1536'; // 'auto': would force w/h inference in the server, so we remove it
export type DalleSizeD3 = '1024x1024' | '1792x1024' | '1024x1792';
export type DalleSizeD2 = '256x256' | '512x512' | '1024x1024';


interface ModuleDalleStore {

  dalleModelId: DalleModelId,
  setDalleModelId: (modelId: DalleModelId) => void;

  dalleNoRewrite: boolean;
  setDalleNoRewrite: (noRewrite: boolean) => void;

  // -- added for gpt-image-1 [2025-04-24] --

  dalleSizeGI: DalleSizeGI;
  setDalleSizeGI: (size: DalleSizeGI) => void;

  dalleQualityGI: DalleImageQualityGI;
  setDalleQualityGI: (quality: DalleImageQualityGI) => void;

  dalleBackgroundGI: DalleBackgroundGI;
  setDalleBackgroundGI: (background: DalleBackgroundGI) => void;

  dalleOutputFormatGI: DalleOutputFormatGI;
  setDalleOutputFormatGI: (format: DalleOutputFormatGI) => void;

  dalleOutputCompressionGI: number;
  setDalleOutputCompressionGI: (compression: number) => void;

  dalleModerationGI: DalleModerationGI;
  setDalleModerationGI: (moderation: DalleModerationGI) => void;

  // -- Dall-E 3 settings --

  dalleSizeD3: DalleSizeD3,
  setDalleSizeD3: (size: DalleSizeD3) => void;

  dalleQualityD3: DalleImageQualityD3,
  setDalleQualityD3: (quality: DalleImageQualityD3) => void;

  dalleStyleD3: DalleImageStyleD3;
  setDalleStyleD3: (style: DalleImageStyleD3) => void;

  // -- Dall-E 2 settings --

  dalleSizeD2: DalleSizeD2,
  setDalleSizeD2: (size: DalleSizeD2) => void;

}

export const useDalleStore = create<ModuleDalleStore>()(
  persist(
    (set) => ({

      dalleModelId: 'gpt-image-1',
      setDalleModelId: (dalleModelId) => set({ dalleModelId }),

      dalleNoRewrite: false,
      setDalleNoRewrite: (dalleNoRewrite) => set({ dalleNoRewrite }),

      // -- added for gpt-image-1 [2025-04-24] --

      dalleSizeGI: '1024x1024',
      setDalleSizeGI: (dalleSizeGI) => set({ dalleSizeGI }),

      dalleQualityGI: 'high',
      setDalleQualityGI: (dalleQualityGI) => set({ dalleQualityGI }),

      dalleBackgroundGI: 'auto',
      setDalleBackgroundGI: (dalleBackgroundGI) => set({ dalleBackgroundGI }),

      dalleOutputFormatGI: 'webp',
      setDalleOutputFormatGI: (dalleOutputFormatGI) => set({ dalleOutputFormatGI }),

      dalleOutputCompressionGI: 100,
      setDalleOutputCompressionGI: (dalleOutputCompressionGI) => set({ dalleOutputCompressionGI }),

      dalleModerationGI: 'low',
      setDalleModerationGI: (dalleModerationGI) => set({ dalleModerationGI }),

      // -- Dall-E 3 settings --

      dalleSizeD3: '1024x1024',
      setDalleSizeD3: (dalleSizeD3) => set({ dalleSizeD3 }),

      dalleQualityD3: 'hd', // was: dalleQuality: 'standard',
      setDalleQualityD3: (dalleQualityD3) => set({ dalleQualityD3 }),

      dalleStyleD3: 'vivid', // was: dalleStyle: 'vivid'
      setDalleStyleD3: (dalleStyleD3) => set({ dalleStyleD3 }),

      // -- Dall-E 2 settings --

      dalleSizeD2: '1024x1024', // was: dalleSize: DALLE_DEFAULT_IMAGE_SIZE
      setDalleSizeD2: (dalleSizeD2) => set({ dalleSizeD2 }),

    }),
    {
      name: 'app-module-dalle',
      version: 2,

      migrate: (state: unknown, fromVersion) => {

        // 2: upgrade model to gpt-image-1
        if (state && fromVersion < 2)
          state = {
            ...(state as ModuleDalleStore),
            dalleModelId: 'gpt-image-1',
          } satisfies ModuleDalleStore;

        return state;
      },

    },
  ),
);