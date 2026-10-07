import { create } from 'zustand';
import { persist } from 'zustand/middleware';


/// Global AI Preferences ///


export type AIVndAntInlineFilesPolicy = 'off' | 'inline-file' | 'inline-file-and-delete' | 'discard';

export type AIVndGeminiVertexLinksPolicy = 'as-is' | 'resolve';

/**
 * Which parallel Beam requests reuse the chat's OpenAI code sandbox (container) from the previous turn. OpenAI runs one
 * request per container at a time: 3+ parallel requests on one container stall for minutes (#1211).
 * - 'all': every request reuses it (default)
 * - 'first': only a request that finds it free reuses it; the others start in a fresh one
 * - 'none': every request starts in a fresh one
 */
export type AIVndOaiBeamSandboxPolicy = 'all' | 'first' | 'none';


interface AIPreferencesState {

  // Vendors: Anthropic special policies
  vndAntInlineFiles: AIVndAntInlineFilesPolicy;

  // Vendors: Gemini/Vertex AI grounding redirect links
  vndGeminiVertexLinks: AIVndGeminiVertexLinksPolicy;

  // Vendors: OpenAI code sandbox reuse across parallel Beam requests
  vndOaiBeamSandbox: AIVndOaiBeamSandboxPolicy;

}

interface AIPreferencesActions {

  // Vendors: Anthropic
  setVndAntInlineFiles: (policy: AIVndAntInlineFilesPolicy) => void;

  // Vendors: Gemini
  setVndGeminiVertexLinks: (policy: AIVndGeminiVertexLinksPolicy) => void;

  // Vendors: OpenAI
  setVndOaiBeamSandbox: (policy: AIVndOaiBeamSandboxPolicy) => void;

  // Maintenance
  resetToDefaults: () => void;

}


const createAIPreferencesDefaults = (): AIPreferencesState => ({
  vndAntInlineFiles: 'inline-file',
  vndGeminiVertexLinks: 'as-is',
  vndOaiBeamSandbox: 'all',
});


export const useAIPreferencesStore = create<AIPreferencesState & AIPreferencesActions>()(persist((_set) => ({

  ...createAIPreferencesDefaults(),

  // Vendors: Anthropic
  setVndAntInlineFiles: (vndAntInlineFiles: AIVndAntInlineFilesPolicy) => _set({ vndAntInlineFiles }),

  // Vendors: Gemini
  setVndGeminiVertexLinks: (vndGeminiVertexLinks: AIVndGeminiVertexLinksPolicy) => _set({ vndGeminiVertexLinks }),

  // Vendors: OpenAI
  setVndOaiBeamSandbox: (vndOaiBeamSandbox: AIVndOaiBeamSandboxPolicy) => _set({ vndOaiBeamSandbox }),

  // Maintenance
  resetToDefaults: () => _set(createAIPreferencesDefaults()),

}), {
  name: 'app-ai-preferences',
  version: 2, // matches the hosted branch, which persists more fields under this key
  migrate: (state: any): AIPreferencesState => state, // no shape change here: passthrough re-stamps older blobs, keeps unknown fields
}));


// Imperative getters/actions (for use outside React)

export function getVndAntInlineFiles(): AIVndAntInlineFilesPolicy {
  return useAIPreferencesStore.getState().vndAntInlineFiles;
}

export function getVndOaiBeamSandbox(): AIVndOaiBeamSandboxPolicy {
  return useAIPreferencesStore.getState().vndOaiBeamSandbox;
}

export function getVndGeminiVertexLinks(): AIVndGeminiVertexLinksPolicy {
  return useAIPreferencesStore.getState().vndGeminiVertexLinks;
}

// export function resetAIPreferencesToDefaults(): void {
//   useAIPreferencesStore.getState().resetToDefaults();
// }
