import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ShortcutDefinition } from './useGlobalShortcuts';


export function shortcutFingerprint(def: Pick<ShortcutDefinition, 'key' | 'ctrl' | 'shift' | 'alt'>): string {
  return `${def.key.toLowerCase()}:${!!def.ctrl}:${!!def.shift}:${!!def.alt}`;
}


interface ShortcutsPreferencesStore {
  disabledShortcuts: string[];
  toggleShortcutDisabled: (fingerprint: string) => void;
}

export const useShortcutsPreferencesStore = create<ShortcutsPreferencesStore>()(
  persist(
    (set) => ({

      disabledShortcuts: [],

      toggleShortcutDisabled: (fingerprint: string) =>
        set((state) => {
          const idx = state.disabledShortcuts.indexOf(fingerprint);
          if (idx >= 0)
            return { disabledShortcuts: state.disabledShortcuts.filter((f) => f !== fingerprint) };
          return { disabledShortcuts: [...state.disabledShortcuts, fingerprint] };
        }),

    }),
    {
      name: 'app-shortcuts-preferences',
      version: 1,
    },
  ),
);


export function isShortcutDenied(def: Pick<ShortcutDefinition, 'key' | 'ctrl' | 'shift' | 'alt'>): boolean {
  const fp = shortcutFingerprint(def);
  return useShortcutsPreferencesStore.getState().disabledShortcuts.includes(fp);
}
