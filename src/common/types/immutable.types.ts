/**
 * Deep immutable type. Usage example: Immutable<DConversation[]>
 */
export type Immutable<T> =
  T extends (...args: any[]) => any ? T  // function types as-is
    : T extends Array<infer U> ? ReadonlyArray<Immutable<U>> // convert arrays into ReadonlyArray
      : T extends Map<infer K, infer V> ? ReadonlyMap<Immutable<K>, Immutable<V>>
        : T extends Set<infer M> ? ReadonlySet<Immutable<M>>
          : T extends object ? { readonly [K in keyof T]: Immutable<T[K]> }  // objects: recursively mark properties as readonly
            : T; // Primitives remain the same
