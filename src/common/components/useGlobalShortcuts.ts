import * as React from 'react';

import { isMacUser } from '../util/pwaUtils';


export const ShortcutKeyName = {
  Esc: 'Escape',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
};

export type GlobalShortcutDefinition = [key: string | false, useCtrl: boolean, useShift: boolean, useAltForNonMac: boolean, action: () => void];

/**
 * Registers multiple global keyboard shortcuts -> function mappings.
 *
 * Important notes below:
 * - [MAC only] the Alt key is ignored even if defined in the shortcut
 * - [MAC only] are not using the command key at the moment, as it interfered with browser shortcuts
 * - stabilize the shortcuts definition (e.g. React.useMemo()) to avoid re-registering the shortcuts at every render
 *
 */
export const useGlobalShortcuts = (shortcuts: GlobalShortcutDefinition[]) => {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const [key, useCtrl, useShift, useAltForNonMac, action] of shortcuts) {
        if (
          key &&
          (useCtrl === event.ctrlKey) &&
          (useShift === event.shiftKey) &&
          (isMacUser /* Mac users won't need the Alt keys */ || useAltForNonMac === event.altKey) &&
          event.key.toLowerCase() === key.toLowerCase()
        ) {
          event.preventDefault();
          event.stopPropagation();
          action();
          break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};
