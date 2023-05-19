import { create } from 'zustand';
import { persist } from 'zustand/middleware';


/// Settings Store

interface SettingsStore {

  // OpenAI API settings

  apiHost: string;
  setApiHost: (apiHost: string) => void;

  apiKey: string;
  setApiKey: (apiKey: string) => void;

  apiOrganizationId: string;
  setApiOrganizationId: (apiOrganizationId: string) => void;

  heliconeKey: string;
  setHeliconeKey: (heliconeKey: string) => void;

  modelTemperature: number;
  setModelTemperature: (modelTemperature: number) => void;

  modelMaxResponseTokens: number;
  setModelMaxResponseTokens: (modelMaxResponseTokens: number) => void;

  // Google Custom Search settings

  googleCloudApiKey: string;
  setGoogleCloudApiKey: (googleApiKey: string) => void;

  googleCSEId: string;
  setGoogleCSEId: (cseId: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({

      // OpenAI API settings

      apiHost: '',
      setApiHost: (apiHost: string) => set({ apiHost }),

      apiKey: '',
      setApiKey: (apiKey: string) => set({ apiKey }),

      apiOrganizationId: '',
      setApiOrganizationId: (apiOrganizationId: string) => set({ apiOrganizationId }),

      heliconeKey: '',
      setHeliconeKey: (heliconeKey: string) => set({ heliconeKey }),

      modelTemperature: 0.5,
      setModelTemperature: (modelTemperature: number) => set({ modelTemperature }),

      modelMaxResponseTokens: 1024,
      setModelMaxResponseTokens: (modelMaxResponseTokens: number) => set({ modelMaxResponseTokens: modelMaxResponseTokens }),

      // Google Custom Search settings

      googleCloudApiKey: '',
      setGoogleCloudApiKey: (googleApiKey: string) => set({ googleCloudApiKey: googleApiKey }),

      googleCSEId: '',
      setGoogleCSEId: (cseId: string) => set({ googleCSEId: cseId }),

    }),
    {
      name: 'app-settings',
    }),
);
