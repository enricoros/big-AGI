import create from 'zustand';
import { persist } from 'zustand/middleware';

import { GptChatModel } from '../components/Settings';
import { SystemPurpose } from '../pages';


// single store for now - we may branch later
interface SettingsState {
  // apiKey: string;
  // setApiKey: (apiKey: string) => void;

  chatModel: GptChatModel;
  setChatModel: (chatModel: GptChatModel) => void;

  systemPurpose: SystemPurpose;
  setSystemPurpose: (purpose: SystemPurpose) => void;
}


export const useSettingsStore = create<SettingsState>()(
  persist((set) => ({
      // apiKey: '',
      chatModel: 'gpt-4',
      systemPurpose: 'Developer',

      // setApiKey: (apiKey: string) => set({ apiKey }),
      setChatModel: (chatModel: GptChatModel) => set({ chatModel }),
      setSystemPurpose: (purpose: SystemPurpose) => set({ systemPurpose: purpose }),
    }),
    {
      name: 'app-settings',
    }),
);
