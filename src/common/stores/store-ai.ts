import { create } from 'zustand';
import { persist } from 'zustand/middleware';


/// Global AI Preferences ///


export type AIVndAntInlineFilesPolicy = 'off' | 'inline-file' | 'inline-file-and-delete';

export type AIVndGeminiVertexLinksPolicy = 'as-is' | 'resolve';


interface AIPreferencesState {

  // Vendors: Anthropic special policies
  vndAntInlineFiles: AIVndAntInlineFilesPolicy;

  // Vendors: Gemini/Vertex AI grounding redirect links
  vndGeminiVertexLinks: AIVndGeminiVertexLinksPolicy;

}

interface AIPreferencesActions {

  // Vendors: Anthropic
  setVndAntInlineFiles: (policy: AIVndAntInlineFilesPolicy) => void;

  // Vendors: Gemini
  setVndGeminiVertexLinks: (policy: AIVndGeminiVertexLinksPolicy) => void;

  // Maintenance
  resetToDefaults: () => void;

}


const createAIPreferencesDefaults = (): AIPreferencesState => ({
  vndAntInlineFiles: 'inline-file',
  vndGeminiVertexLinks: 'as-is',
});


export const useAIPreferencesStore = create<AIPreferencesState & AIPreferencesActions>()(persist((_set) => ({

  ...createAIPreferencesDefaults(),

  // Vendors: Anthropic
  setVndAntInlineFiles: (vndAntInlineFiles: AIVndAntInlineFilesPolicy) => _set({ vndAntInlineFiles }),

  // Vendors: Gemini
  setVndGeminiVertexLinks: (vndGeminiVertexLinks: AIVndGeminiVertexLinksPolicy) => _set({ vndGeminiVertexLinks }),

  // Maintenance
  resetToDefaults: () => _set(createAIPreferencesDefaults()),

}), {
  name: 'app-ai-preferences',
}));


// Imperative getters/actions (for use outside React)

export function getVndAntInlineFiles(): AIVndAntInlineFilesPolicy {
  return useAIPreferencesStore.getState().vndAntInlineFiles;
}

export function getVndGeminiVertexLinks(): AIVndGeminiVertexLinksPolicy {
  return useAIPreferencesStore.getState().vndGeminiVertexLinks;
}

// export function resetAIPreferencesToDefaults(): void {
//   useAIPreferencesStore.getState().resetToDefaults();
// }
