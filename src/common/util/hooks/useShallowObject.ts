import * as React from 'react';

/**
 * Shallow compare two objects for equality.
 * Returns true if the objects have the same properties and values.
 */
export function shallowEquals<T>(objA: T, objB: T): boolean {

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

  // count keys in objB without allocation (optimized: avoids Object.keys(objB))
  let countB = 0;
  for (const _ in objB)
    if (Object.hasOwn(objB, _)) countB++;

  // Object  shallow compare (key and value equality)
  const keysA = Object.keys(objA) as (keyof T)[];
  if (keysA.length !== countB)
    return false;
  for (const keyA of keysA)
    if (!Object.hasOwn(objB, keyA) || !Object.is(objA[keyA], objB[keyA]))
      return false;
  return true;
}


/**
 * Marks a reference the hooks below keep identity-stable across renders while
 * shallow-equal. Identity on T: the `object | null` constraint is the whole
 * contract - primitives are identity-stable already, null is a legit 'absent'
 * value, undefined is reserved as the refs' 'unset' sentinel.
 */
type _StableType<T extends _NullableObject> = T;
type _NullableObject = object | null;

/**
 * Returns a stable object reference when the value has not 'shallow' changed.
 * Useful to avoid unnecessary re-renders when the object reference changes but
 * the internal properties are the same.
 *
 * In case of b = { ...a }, b will be the same object reference as a when
 * the properties are the same.
 */
export function useShallowStable<T extends _NullableObject>(value: T): _StableType<T> {
  /*
   * Ref to store the last value, so we can compare it with the new value, and
   * return the same object reference when the properties are 'shallow' equal.
   */
  const ref = React.useRef<T>(value);

  return React.useMemo(() => {
    if (!shallowEquals(ref.current, value))
      ref.current = value;
    return ref.current;
  }, [value]);
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
export function useMemoShallowStable<T extends _NullableObject>(factory: () => T, deps: React.DependencyList): _StableType<T> {

  // holds the last returned value, to preserve identity when shallow-equal
  const ref = React.useRef<T | undefined>(undefined);

  return React.useMemo(() => {
    const next = factory();
    if (ref.current === undefined || !shallowEquals(ref.current, next))
      ref.current = next;
    return ref.current;
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );
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
export function useShallowStabilizer<T extends _NullableObject>(): (value: T) => _StableType<T> {
  const ref = React.useRef<T | undefined>(undefined);

  return React.useCallback((next: T) => {
    if (ref.current === undefined || !shallowEquals(ref.current, next))
      ref.current = next;
    return ref.current;
  }, []);
}