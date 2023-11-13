import * as React from 'react';

/**
 * Registers a global keyboard shortcut (if not undefined) to activate a callback.
 *
 * @param shortcutKey If undefined, the shortcut will not be registered.
 * @param useCtrl If true, the Ctrl key must be pressed for the shortcut to be activated.
 * @param useShift If true, the Shift key must be pressed for the shortcut to be activated.
 * @param useAlt If true, the Alt key must be pressed for the shortcut to be activated.
 * @param callback Make sure this is a memoized callback, otherwise the effect will be re-registered every time.
 */
export const useGlobalShortcut = (shortcutKey: string | undefined, useCtrl: boolean, useShift: boolean, useAlt: boolean, callback: () => void) => {
  React.useEffect(() => {
    if (!shortcutKey) return;
    const lcShortcut = shortcutKey.toLowerCase();
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((useCtrl === event.ctrlKey) && (useShift === event.shiftKey) && (useAlt === event.altKey)
        && event.key.toLowerCase() === lcShortcut) {
        event.preventDefault();
        event.stopPropagation();
        callback();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callback, shortcutKey, useCtrl, useShift]);
};