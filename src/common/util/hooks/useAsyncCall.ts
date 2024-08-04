import * as React from 'react';

interface AsyncState<T> {
  isLoading: boolean;
  error: Error | null;
  data: T | null;
}

export function useAsyncCall<T extends (...args: any[]) => Promise<any>>(asyncFunction: T) {
  const [state, setState] = React.useState<AsyncState<Awaited<ReturnType<T>>>>({
    isLoading: false,
    error: null,
    data: null,
  });

  const isMounted = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const execute = React.useCallback(
    async (...args: Parameters<T>) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await asyncFunction(...args);
        if (isMounted.current) {
          setState({ isLoading: false, error: null, data: result });
        }
        return result;
      } catch (err) {
        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err : new Error('An error occurred'),
          }));
        }
        throw err;
      }
    },
    [asyncFunction],
  );

  return [state.isLoading, execute, state.error, state.data] as const;
}