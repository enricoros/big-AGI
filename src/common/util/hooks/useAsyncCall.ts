import * as React from 'react';

interface AsyncState<TData> {
  isLoading: boolean;
  error: Error | null;
  data: TData | null;
}

type AsyncFunction<TArgs extends any[], TResult> = (...args: TArgs) => Promise<TResult>;

type AsyncCallResult<TArgs extends any[], TResult> = [
  isLoading: boolean,
  execute: (...args: TArgs) => Promise<TResult>,
  error: Error | null,
  data: TResult | null
];


/**
 * Simplifies calls to `async` operations in React components.
 *
 * Ideal for standardizing async patterns in React applications, particularly
 * for API calls, data fetching, and other asynchronous tasks:
 *
 * - react to state: loading, error, and data being set
 * - type safe: maintain typescript types throughout
 * - misc: prevent stale closures, memory leaks (on unmount), boilerplate
 */
export function useAsyncCall<TArgs extends any[], TResult>(asyncFunction: AsyncFunction<TArgs, TResult>): AsyncCallResult<TArgs, TResult> {

  // least amount of state - updated pre, post, and in case of error
  const [state, setState] = React.useState<AsyncState<TResult>>({
    isLoading: false,
    error: null,
    data: null,
  });

  const isMounted = React.useRef(true);
  const latestAsyncFunction = React.useRef(asyncFunction);

  React.useEffect(() => {
    latestAsyncFunction.current = asyncFunction;
    return () => {
      isMounted.current = false;
    };
  }, [asyncFunction]);

  const execute = React.useCallback(async (...args: TArgs): Promise<TResult> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await latestAsyncFunction.current(...args);
      if (isMounted.current) {
        setState({ isLoading: false, error: null, data: result });
      }
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An error occurred');
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error,
        }));
      }
      throw error;
    }
  }, []);

  return [state.isLoading, execute, state.error, state.data];
}