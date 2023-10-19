import * as React from 'react';

export function useToggleableBoolean(initialValue: boolean = false) {
  const [value, setValue] = React.useState<boolean>(initialValue);
  return { on: value, toggle: () => setValue(!value) };
}

export type ToggleableBoolean = ReturnType<typeof useToggleableBoolean>;
