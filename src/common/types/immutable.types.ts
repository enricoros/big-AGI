/**
 * Deep immutable type. Usage example: Immutable<DConversation[]>
 */
export type Immutable<T> =
  T extends (...args: any[]) => any ? T  // function types as-is
    : T extends string | number | boolean | bigint | symbol ? T // primitives as-is, before 'object': keeps open sets like `'a' | (string & {})` and branded primitives intact
      : T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<Immutable<K>, Immutable<V>> // also matches Map
        : T extends ReadonlySet<infer M> ? ReadonlySet<Immutable<M>> // also matches Set
          : T extends object ? { readonly [K in keyof T]: Immutable<T[K]> }  // objects, arrays and tuples: recursively readonly
            : T; // null and undefined remain the same
