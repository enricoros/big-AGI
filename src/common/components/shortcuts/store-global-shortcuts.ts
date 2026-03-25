import { create } from 'zustand';

import { hasKeys } from '~/common/util/objectUtils';

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

const areShortcutObjectsEqual = (a: ShortcutObject, b: ShortcutObject): boolean => (
  a.key === b.key
  && a.ctrl === b.ctrl
  && a.shift === b.shift
  && a.alt === b.alt
  && a.description === b.description
  && a.disabled === b.disabled
  && a.skipIfInput === b.skipIfInput
  && a.action === b.action
  && a.endDecoratorIcon === b.endDecoratorIcon
  && a.level === b.level
);

const areShortcutGroupsEqual = (a: ShortcutObject[] | undefined, b: ShortcutObject[]): boolean => {
  if (!a || a.length !== b.length)
    return false;

  for (let i = 0; i < a.length; i++)
    if (!areShortcutObjectsEqual(a[i], b[i]))
      return false;

  return true;
};


export const useGlobalShortcutsStore = create<ShortcutsStore>((set, get) => ({

  shortcutGroups: {},
  hasShortcuts: false,

  setGroupShortcuts: (groupId: ShortcutGroupId, shortcuts: ShortcutObject[]) =>
    set((state) => {
      const previousShortcuts = state.shortcutGroups[groupId];
      if (areShortcutGroupsEqual(previousShortcuts, shortcuts))
        return state;

      return {
        shortcutGroups: { ...state.shortcutGroups, [groupId]: shortcuts },
        hasShortcuts: true,
      };
    }),

  removeGroup: (groupId) =>
    set((state) => {
      const { [groupId]: _, ...rest } = state.shortcutGroups;
      return {
        shortcutGroups: rest,
        hasShortcuts: hasKeys(rest),
      };
    }),

  /**
   * Returns all shortcuts, priritized by level (descending).
   */
  getAllShortcuts: () => Object.values(get().shortcutGroups)
    .flat()
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0)),

}));
