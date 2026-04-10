import { create } from 'zustand';
import { persist } from 'zustand/middleware';


/// Global AI Preferences ///


export type AIVndAntInlineFilesPolicy = 'off' | 'inline-file' | 'inline-file-and-delete';


interface AIPreferencesState {

  // Anthropic
  vndAntInlineFiles: AIVndAntInlineFilesPolicy;

}

interface AIPreferencesActions {

  // Anthropic
  setVndAntInlineFiles: (policy: AIVndAntInlineFilesPolicy) => void;

  // Maintenance
  resetToDefaults: () => void;

}


const createAIPreferencesDefaults = (): AIPreferencesState => ({
  vndAntInlineFiles: 'inline-file',
});


export const useAIPreferencesStore = create<AIPreferencesState & AIPreferencesActions>()(persist((_set) => ({

  ...createAIPreferencesDefaults(),

  // Anthropic
  setVndAntInlineFiles: (vndAntInlineFiles: AIVndAntInlineFilesPolicy) => _set({ vndAntInlineFiles }),

  // Maintenance
  resetToDefaults: () => _set(createAIPreferencesDefaults()),

}), {
  name: 'app-ai-preferences',
}));


// Imperative getters/actions (for use outside React)

export function getVndAntInlineFiles(): AIVndAntInlineFilesPolicy {
  return useAIPreferencesStore.getState().vndAntInlineFiles;
}

// export function resetAIPreferencesToDefaults(): void {
//   useAIPreferencesStore.getState().resetToDefaults();
// }
