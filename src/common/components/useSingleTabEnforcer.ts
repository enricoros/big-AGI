import * as React from 'react';

/**
 * A tiny LocalStorage-based single-tab enforcer.
 * Returns `[isActive, activate]`, where `isActive` is true if this tab
 * currently "owns" the app, and `activate()` lets this tab claim ownership.
 */
export function useSingleTabEnforcer(
  channelName: string
): [isActive: boolean, activate: () => void] {
  const clientId = React.useRef(Math.random().toString(36).slice(2, 10)).current;
  const storageKey = `${channelName}:activeId`;
  const [isActive, setIsActive] = React.useState(true);

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        setIsActive(e.newValue === clientId);
      }
    };
    window.addEventListener('storage', onStorage);

    // Claim this tab as active on mount
    localStorage.setItem(storageKey, clientId);
    setIsActive(true);

    return () => {
      window.removeEventListener('storage', onStorage);
      // On unmount, if we're still the owner, clear the lock
      if (localStorage.getItem(storageKey) === clientId) {
        localStorage.removeItem(storageKey);
      }
    };
  }, [storageKey, clientId]);

  const activate = React.useCallback(() => {
    localStorage.setItem(storageKey, clientId);
    setIsActive(true);
  }, [storageKey, clientId]);

  return [isActive, activate];
}