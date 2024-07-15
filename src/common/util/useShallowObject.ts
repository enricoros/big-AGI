import * as React from 'react';

function shallowEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false;
  }
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (let key of keys1) {
    if (!obj2.hasOwnProperty(key) || obj1[key] !== obj2[key]) {
      return false;
    }
  }
  return true;
}

export function useStableObject<T extends object>(obj: T): T {
  const ref = React.useRef<T>(obj);

  return React.useMemo(() => {
    if (!shallowEqual(ref.current, obj))
      ref.current = obj;
    return ref.current;
  }, [obj]);
}
