import * as React from 'react';
import { isMacUser } from '../util/pwaUtils';

export const ShortcutKeyName = {
  Esc: 'Escape',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
};

export type GlobalShortcutItem = [key: string | false, ctrl: boolean, shift: boolean, alt: boolean, action: () => void];

/**
 * Registers multiple global keyboard shortcuts to activate callbacks.
 *
 * @param shortcuts An array of shortcut objects.
 */
export const useGlobalShortcuts = (shortcuts: GlobalShortcutItem[]) => {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const [key, useCtrl, useShift, useAlt, action] of shortcuts) {
        if (
          key &&
          (useCtrl === event.ctrlKey) &&
          (useShift === event.shiftKey) &&
          (isMacUser ? true : useAlt === event.altKey) &&
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
