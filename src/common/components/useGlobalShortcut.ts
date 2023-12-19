import * as React from 'react';

export const ShortcutKeyName = {
  Esc: 'Escape',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
};


/**
 * Registers a global keyboard shortcut (if not undefined) to activate a callback.
 *
 * @param shortcutKey If undefined, the shortcut will not be registered.
 * @param useCtrl If true, the Ctrl key must be pressed for the shortcut to be activated.
 * @param useShift If true, the Shift key must be pressed for the shortcut to be activated.
 * @param useAlt If true, the Alt key must be pressed for the shortcut to be activated.
 * @param callback Make sure this is a memoized callback, otherwise the effect will be re-registered every time.
 */
export const useGlobalShortcut = (shortcutKey: string | false, useCtrl: boolean, useShift: boolean, useAlt: boolean, callback: () => void) => {
  React.useEffect(() => {
    if (!shortcutKey) return;
    const lcShortcut = shortcutKey.toLowerCase();
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = (event.ctrlKey && !event.metaKey) || (event.metaKey && !event.ctrlKey);
      if (
        (useCtrl === isCtrlOrCmd) &&
        (useShift === event.shiftKey) &&
        (useAlt === event.altKey) &&
        event.key.toLowerCase() === lcShortcut
      ) {
        event.preventDefault();
        event.stopPropagation();
        callback();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callback, shortcutKey, useAlt, useCtrl, useShift]);
};


export type GlobalShortcutItem = [key: string, ctrl: boolean, shift: boolean, alt: boolean, action: () => void];


/**
 * Registers multiple global keyboard shortcuts to activate callbacks.
 *
 * @param shortcuts An array of shortcut objects.
 */
export const useGlobalShortcuts = (shortcuts: GlobalShortcutItem[]) => {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const [key, useCtrl, useShift, useAlt, action] of shortcuts) {
        const isCtrlOrCmd = (event.ctrlKey && !event.metaKey) || (event.metaKey && !event.ctrlKey);
        if (
          key &&
          (useCtrl === isCtrlOrCmd) &&
          (useShift === event.shiftKey) &&
          (useAlt === event.altKey) &&
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