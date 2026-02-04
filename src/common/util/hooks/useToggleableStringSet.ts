import * as React from 'react';


// in-memory map to remember the last state across remounts
const _memoryStates = new Map<string, Set<string>>();

const _stableSetCreator = <T>(): Set<T> => new Set();

/**
 * Hook for managing a toggleable Set of string values.
 * @param inMemKey - if set, persists the set in memory across remounts (not across reloads)
 */
export function useToggleableStringSet<TValue extends string>(inMemKey?: string) {

  const [set, setSet] = React.useState<Set<TValue>>(
    () => (inMemKey && _memoryStates.get(inMemKey) as Set<TValue>) || _stableSetCreator<TValue>(),
  );

  const toggle = React.useCallback((value: TValue) => {
    setSet(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      if (inMemKey)
        _memoryStates.set(inMemKey, next);
      return next;
    });
  }, [inMemKey]);

  return { set, toggle };
}
