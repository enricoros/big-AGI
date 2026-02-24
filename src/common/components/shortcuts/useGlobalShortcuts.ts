import * as React from 'react';

import { SvgIcon } from '@mui/joy';

import { useGlobalShortcutsStore } from './store-global-shortcuts';

import { ensureGlobalShortcutHandler } from './globalShortcutsHandler';


export const ShortcutKey = {
  Backspace: 'Backspace',
  Enter: 'Enter',
  Esc: 'Escape',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
};

/** Base key-combo definition shared by registration and catalog. */
export interface ShortcutDefinition {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description?: string;
}

export interface ShortcutObject extends ShortcutDefinition {
  disabled?: boolean;
  action: (() => void) | '_specialPrintShortcuts';
  endDecoratorIcon?: typeof SvgIcon;
  level?: number; // if set, it will exclusively show icons at that level of priority and hide the others
}


/**
 * Hook to register global shortcuts for a specific group.
 *
 * Important notes below:
 * - [MAC only] the Alt key is ignored even if defined in the shortcut
 * - [MAC only] are not using the command key at the moment, as it interfered with browser shortcuts
 * - stabilize the shortcuts definition (e.g. React.useMemo()) to avoid re-registering the shortcuts at every render
 *
 */
export const useGlobalShortcuts = (groupId: string, shortcuts: ShortcutObject[]) => {
  React.useEffect(() => {
    const { setGroupShortcuts, removeGroup } = useGlobalShortcutsStore.getState();

    setGroupShortcuts(groupId, shortcuts);
    ensureGlobalShortcutHandler();

    return () => {
      removeGroup(groupId);
      ensureGlobalShortcutHandler();
    };
  }, [groupId, shortcuts]);
};
