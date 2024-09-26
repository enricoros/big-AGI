import React from 'react';


/*
 * Custom implementation of deep equality check for objects and arrays.
 * Note that some libs provide it, but we don't want another dependency and this
 * is just right for us.
 */
export function isDeepEqual<T>(a: T, b: T): boolean {
  // Check if both are the same reference or both are null/undefined
  if (a === b) return true;

  // Check if either is null/undefined (but not both, as that case is handled above)
  if (a == null || b == null) return false;

  // If objects don't have the same constructor, they are not equal
  if (a.constructor !== b.constructor) return false;

  // Specific handling for arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++)
      if (!isDeepEqual(a[i], b[i])) return false;
    return true;
  }

  // Handle generic objects
  if (typeof a === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    // Check if objects have different number of keys
    if (aKeys.length !== bKeys.length) return false;

    // Check if objects have different keys or different values for the same keys
    for (const key of aKeys)
      if (!bKeys.includes(key) || !isDeepEqual((a as any)[key], (b as any)[key])) return false;

    return true;
  }

  // If none of the complex object checks apply or if they fail, the objects are not deeply equal
  return false;
}


export function useDeep<S, U>(selector: (state: S) => U): (state: S) => U {
  const prev = React.useRef<U>();
  return (state) => {
    const next = selector(state);
    return isDeepEqual(prev.current, next)
      ? (prev.current as U)
      : (prev.current = next);
  };
}