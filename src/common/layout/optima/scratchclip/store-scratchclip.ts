import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { agiUuid } from '~/common/util/idUtils';
import { useShallow } from 'zustand/react/shallow';
import { supportsClipboardRead } from '~/common/util/clipboardUtils';


// configuration
const MAX_HISTORY_ITEMS = 10;
const MAX_SNIPPET_LENGTH = 20000;


export interface ClipboardHistoryItem {
  id: string;
  text: string;
  timestamp: number;
  source?: string; // Optional: e.g., 'textarea', 'contentEditable'
}


interface ScratchClipState {
  history: ClipboardHistoryItem[];
  isVisible: boolean; // not persisted
}

interface ScratchClipActions {
  addSnippet: (text: string, sourceElement?: HTMLElement) => void;
  removeSnippet: (id: string) => void;
  clearHistory: () => void;
  toggleVisibility: () => void;
  setClipboardVisibility: (isVisible: boolean) => void; // Explicit set
}

type ScratchClipStore = ScratchClipState & ScratchClipActions;


const useScratchClipStore = create<ScratchClipStore>()(persist(
  (set, _get) => ({

    // initial state
    history: [],
    isVisible: false,


    addSnippet: (text, sourceElement) => {
      const trimmedText = text.trim();
      if (!trimmedText || trimmedText.length === 0 || trimmedText.length > MAX_SNIPPET_LENGTH) {
        console.log('ScratchClip: Snippet empty or too long, not adding.');
        return;
      }

      set((state) => {
        // Avoid adding if it's the exact same as the most recent one
        if (state.history.length > 0 && state.history[0].text === trimmedText) {
          const existingItemIndex = state.history.findIndex(item => item.text === trimmedText);
          if (existingItemIndex === 0) return state; // Already the most recent
        }

        let sourceDescription: string | undefined = undefined;
        if (sourceElement) {
          sourceDescription = sourceElement.id || sourceElement.tagName?.toLowerCase() || 'unknown';
          // Example: const parentEditor = sourceElement.closest('[data-editor-id]');
          // if (parentEditor) sourceDescription = `Editor: ${parentEditor.dataset.editorId}`;
        }

        const newSnippet: ClipboardHistoryItem = {
          id: agiUuid('clip-history'),
          text: trimmedText,
          timestamp: Date.now(),
          source: sourceDescription,
        };

        // Remove existing occurrences of the same text to avoid duplicates, then add new one to top
        const filteredHistory = state.history.filter(item => item.text !== trimmedText);
        const newHistory = [newSnippet, ...filteredHistory].slice(0, MAX_HISTORY_ITEMS);
        return { history: newHistory };
      });
    },

    removeSnippet: (id: string) => {
      set((state) => ({
        history: state.history.filter(item => item.id !== id),
      }));
    },

    clearHistory: () => set({ history: [] }),

    toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
    setClipboardVisibility: (isVisible) => set({ isVisible }),

  }),
  {

    name: 'agi-scratch-clip',

    partialize: ({ history }) => ({
      history, // only persist history
    }),

  }),
);


// actions

export function scratchClipSupported() {
  return supportsClipboardRead();
}

export function scratchClipActions(): ScratchClipActions {
  return useScratchClipStore.getState();
}


// hooks

export function useScratchClipHistory() {
  return useScratchClipStore(useShallow(state => ({
    history: state.history,
    isVisible: state.isVisible,
  })));
}

export function useScratchClipVisibility() {
  const isVisible = useScratchClipStore((state) => state.isVisible);
  return { isVisible, toggleVisibility: useScratchClipStore.getState().toggleVisibility };
}
