import * as React from 'react';

// in-memory map to remember the last state
const toggleStates = new Map<string, boolean>();

export function useToggleableBoolean(initialValue: boolean = false, key?: string) {

  // Retrieve the initial value from memory if a key is provided and exists in the map
  const memoryValue = key ? toggleStates.get(key) : undefined;

  // state
  const [value, setValue] = React.useState<boolean>(memoryValue ?? initialValue);

  // Define the toggle function
  const toggle = React.useCallback(() => {
    setValue(state => {
      const newValue = !state;
      // If a key is provided, update the value in the map
      if (key)
        toggleStates.set(key, newValue);
      return newValue;
    });
  }, [key]);

  return { on: value, toggle };
}

export type ToggleableBoolean = ReturnType<typeof useToggleableBoolean>;