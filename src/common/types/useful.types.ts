// Useful types that are not specific to us

/**
 * Could be a value (or void) or a promise of it
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * In our app 'undefined' and 'null' must be different, so we don't use 'Maybe' type
 * - undefined: missing value, never read, etc.
 * - null: means 'force no value', 'force empty', etc.
 */
// export type Maybe<T> = T | null | undefined;
