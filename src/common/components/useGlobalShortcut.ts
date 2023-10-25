import * as React from 'react';

/**
 * Registers a global keyboard shortcut (if not undefined) to activate a callback.
 *
 * @param shortcutKey 'm' for "Ctrl + M"
 * @param callback Make sure this is a memoized callback, otherwise the effect will be re-registered every time.
 */
export const useGlobalShortcut = (shortcutKey: string | undefined, callback: () => void) => {
  React.useEffect(() => {
    if (!shortcutKey) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === shortcutKey)
        callback();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callback, shortcutKey]);
};