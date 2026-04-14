import * as React from 'react';

/**
 * Shallow compare two objects for equality.
 * Returns true if the objects have the same properties and values.
 */
export function shallowEquals<T>(objA: T, objB: T) {

  // like '===' but handles two corner cases differently:
  // - +0 and -0 are different
  // - NaN and NaN are the same
  if (Object.is(objA, objB))
    return true;

  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null)
    return false;

  // Map: special case
  if (objA instanceof Map && objB instanceof Map) {
    if (objA.size !== objB.size)
      return false;
    for (const [key, value] of objA)
      if (!Object.is(value, objB.get(key)))
        return false;
    return true;
  }

  // Set: special case
  if (objA instanceof Set && objB instanceof Set) {
    if (objA.size !== objB.size)
      return false;
    for (const value of objA)
      if (!objB.has(value))
        return false;
    return true;
  }

  // Array: shallow compare
  if (Array.isArray(objA)) {
    if (!Array.isArray(objB) || objA.length !== objB.length)
      return false;
    for (let i = 0; i < objA.length; i++)
      if (!Object.is(objA[i], objB[i]))
        return false;
    return true;
  }

  // Object  shallow compare (key and value equality)
  const keysA = Object.keys(objA) as (keyof T)[];
  if (keysA.length !== Object.keys(objB).length)
    return false;
  for (const keyA of keysA)
    if (!Object.hasOwn(objB, keyA as string) || !Object.is(objA[keyA], objB[keyA]))
      return false;
  return true;
}


type StableType<T> = T extends any[] ? T : T extends object ? T : never;

/**
 * Returns a stable object reference when the value has not 'shallow' changed.
 * Useful to avoid unnecessary re-renders when the object reference changes but
 * the internal properties are the same.
 *
 * In case of b = { ...a }, b will be the same object reference as a when
 * the properties are the same.
 */
export function useShallowStable<T>(value: T): StableType<T> {
  /*
   * Ref to store the last value, so we can compare it with the new value, and
   * return the same object reference when the properties are 'shallow' equal.
   */
  const ref = React.useRef<T>(value);

  return React.useMemo(() => {
    if (!shallowEquals<T>(ref.current, value))
      ref.current = value;
    return ref.current;
  }, [value]) as StableType<T>;
}


/**
 * Like `React.useMemo`, but additionally preserves the previous reference when
 * the newly computed value is shallow-equal to the previous one.
 *
 * Useful when the memo deps are granular enough to invalidate the factory, but
 * the resulting object/array often comes out structurally identical - so
 * downstream consumers (memoized components, further memos, effects) should
 * not see a new reference.
 *
 * @example
 *   const summary = useMemoShallowStable(() => ({
 *     total: items.reduce((n, i) => n + i.size, 0),
 *     count: items.length,
 *   }), [items]);
 */
export function useMemoShallowStable<T>(factory: () => T, deps: React.DependencyList): StableType<T> {

  // holds the last returned value, to preserve identity when shallow-equal
  const ref = React.useRef<T | undefined>(undefined);

  return React.useMemo(() => {
    const next = factory();
    if (ref.current === undefined || !shallowEquals<T>(ref.current, next))
      ref.current = next;
    return ref.current;
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  ) as StableType<T>;
}


/**
 * Returns a `function` that will stabilize the object reference
 * when the value has not 'shallow' changed.
 *
 * Example:
 *   ...
 *   const stabilizePrinter = useShallowStabilizer<PrinterObjectType>();
 *   ...
 *   const printer = stabilizePrinter({...printerValue});
 *   ...
 */
export function useShallowStabilizer<T>(): (value: T) => T {
  const ref = React.useRef<T | null>(null);

  return React.useCallback((value: T) => {
    if (ref.current === null || !shallowEquals<T>(ref.current, value))
      ref.current = value;
    return ref.current;
  }, []);
}