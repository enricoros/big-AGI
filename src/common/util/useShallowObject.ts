import * as React from 'react';

function shallowEqual(a: any, b: any): boolean {
  // Shallow compare
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }

  // Array shallow compare (element equality)
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Object shallow compare (key and value equality)
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let key of keysA) {
    if (!b.hasOwnProperty(key) || a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

type StableType<T> = T extends any[] ? T : T extends object ? T : never;

export function useShallowStable<T>(value: T): StableType<T> {
  const ref = React.useRef<T>(value);

  return React.useMemo(() => {
    if (!shallowEqual(ref.current, value))
      ref.current = value;
    return ref.current;
  }, [value]) as StableType<T>;
}
