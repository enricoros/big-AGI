import * as React from 'react';

interface AsyncState<TData> {
  isLoading: boolean;
  error: Error | null;
  lastSuccessfulData: TData | null;
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
 * - react to state: LOADING (the main reason for this), error, and data being set
 * - type safe: maintain typescript types throughout
 * - misc: prevent stale closures, memory leaks (on unmount - NOTE: REMOVED!), boilerplate
 */
export function useAsyncCallBusy<TArgs extends any[], TResult>(asyncFunction: AsyncFunction<TArgs, TResult>): AsyncCallResult<TArgs, TResult> {

  // least amount of state - updated pre, post, and in case of error
  const [state, setState] = React.useState<AsyncState<TResult>>({
    isLoading: false,
    error: null,
    lastSuccessfulData: null,
  });

  const latestAsyncFunction = React.useRef(asyncFunction);

  React.useEffect(() => {
    latestAsyncFunction.current = asyncFunction;
  }, [asyncFunction]);

  const execute = React.useCallback(async (...args: TArgs): Promise<TResult> => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const result = await latestAsyncFunction.current(...args);
      setState({
        isLoading: false,
        error: null,
        lastSuccessfulData: result,
      });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An error occurred');
      setState(prev => ({
        ...prev,
        isLoading: false,
        error,
      }));
      throw error;
    }
  }, []);

  return [state.isLoading, execute, state.error, state.lastSuccessfulData];
}