import { create } from 'zustand';

import type { ShortcutObject } from './useGlobalShortcuts';


type ShortcutGroupId = string;

interface ShortcutsStore {
  // state
  shortcutGroups: Record<ShortcutGroupId, ShortcutObject[]>;
  hasShortcuts: boolean;
  // actions
  setGroupShortcuts: (groupId: ShortcutGroupId, shortcuts: ShortcutObject[]) => void;
  removeGroup: (groupId: ShortcutGroupId) => void;
  getAllShortcuts: () => ShortcutObject[];
}


export const useGlobalShortcutsStore = create<ShortcutsStore>((set, get) => ({

  shortcutGroups: {},
  hasShortcuts: false,

  setGroupShortcuts: (groupId: ShortcutGroupId, shortcuts: ShortcutObject[]) =>
    set((state) => ({
      shortcutGroups: { ...state.shortcutGroups, [groupId]: shortcuts },
      hasShortcuts: true,
    })),

  removeGroup: (groupId) =>
    set((state) => {
      const { [groupId]: _, ...rest } = state.shortcutGroups;
      return {
        shortcutGroups: rest,
        hasShortcuts: Object.keys(rest).length > 0,
      };
    }),

  getAllShortcuts: () => Object.values(get().shortcutGroups).flat(),

}));
