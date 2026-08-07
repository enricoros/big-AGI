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
  /** Focus moved: re-notifies subscribers so read-time eligibility re-resolves (the global handler's focus listener calls this, coalesced). */
  focusTick: () => void;
  resolveShortcuts: () => ShortcutObject[];
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
        hasShortcuts: hasKeys(rest),
      };
    }),

  /**
   * All registered shortcuts in precedence order: level descending, then focus-scoped first
   * (at equal level a scoped, more specific entry beats an unscoped one).
   */
  getAllShortcuts: () => Object.values(get().shortcutGroups)
    .flat()
    .sort((a, b) => ((b.level ?? 0) - (a.level ?? 0)) || ((b.focusWithin ? 1 : 0) - (a.focusWithin ? 1 : 0))),

  focusTick: () => set((state) => ({ shortcutGroups: { ...state.shortcutGroups } })),

  /**
   * THE resolution both consumers share - the keydown handler EXECUTES these, the StatusBar
   * DISPLAYS them, so shown <=> fires by construction. Eligibility (focusWithin containment,
   * skipIfInput) is read-time and applied BEFORE the per-combo dedupe: an ineligible entry
   * never shadows an eligible lower one. `alt` is not combo identity (matching ignores it);
   * `disabled` winners stay - shown greyed, they consume their key without acting.
   */
  resolveShortcuts: () => {
    const winners: ShortcutObject[] = [];
    const seenCombos = new Set<string>();
    for (const shortcut of get().getAllShortcuts()) {
      if (shortcut.focusWithin && !(document.activeElement && shortcut.focusWithin.current?.contains(document.activeElement)))
        continue;
      if (shortcut.skipIfInput && _isTextInputFocused())
        continue;
      const combo = `${shortcut.key.toLowerCase()}|${!!shortcut.ctrl}|${!!shortcut.shift}`;
      if (seenCombos.has(combo)) continue;
      seenCombos.add(combo);
      winners.push(shortcut);
    }
    return winners;
  },

}));

/** True if the active element (or a focused ancestor) is a text input, textarea, or contenteditable. */
function _isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el || el === document.body)
    return false;
  if (el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'search' || el.type === 'url' || el.type === 'email' || el.type === 'password' || el.type === 'number' || el.type === 'tel'))
    return true;
  if (el instanceof HTMLTextAreaElement)
    return true;
  // check the element and its ancestors for contenteditable
  let node: Element | null = el;
  while (node) {
    if (node instanceof HTMLElement && node.isContentEditable)
      return true;
    node = node.parentElement;
  }
  return false;
}
