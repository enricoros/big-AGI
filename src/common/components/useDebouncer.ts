import * as React from 'react';

export function useDebouncer<TValue = string | number>(
  initialValue: TValue,
  delayMs: number,
  deadlineMs?: number,
  immediate?: boolean,
): [TValue, TValue, (newValue: TValue | ((prevState: TValue) => TValue)) => void, () => TValue] {
  const [immediateValue, setImmediateValue] = React.useState<TValue>(initialValue);
  const [debouncedValue, setDebouncedValue] = React.useState<TValue>(initialValue);
  const valueRef = React.useRef(initialValue);
  const debounceTimeoutRef = React.useRef<number>();
  const deadlineTimeoutRef = React.useRef<number>();

  const clearDebounceTimeout = React.useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = undefined;
    }
  }, []);

  const clearDeadlineTimeout = React.useCallback(() => {
    if (deadlineTimeoutRef.current) {
      clearTimeout(deadlineTimeoutRef.current);
      deadlineTimeoutRef.current = undefined;
    }
  }, []);

  const setValue = React.useCallback((_newValue: TValue | ((prevState: TValue) => TValue)) => {
    clearDebounceTimeout();
    // @ts-expect-error _newValue can be a function type (cannot, but lint doesn't know)
    const newValue: TValue = typeof _newValue === 'function' ? _newValue(valueRef.current) : _newValue;
    valueRef.current = newValue;
    // trigger an immediate update
    if (immediate)
      setImmediateValue(newValue);

    const handler = () => {
      setDebouncedValue(valueRef.current);
      clearDeadlineTimeout();
    };

    // Set the debounce timeout
    debounceTimeoutRef.current = window.setTimeout(handler, delayMs);

    // Set the deadline timeout if it hasn't been set already
    if (typeof deadlineMs === 'number' && deadlineMs > delayMs && deadlineTimeoutRef.current === undefined)
      deadlineTimeoutRef.current = window.setTimeout(handler, deadlineMs);

  }, [clearDebounceTimeout, immediate, delayMs, deadlineMs, clearDeadlineTimeout]);

  const getValue = React.useCallback(() => valueRef.current, []);

  React.useEffect(() => {
    return () => {
      clearDebounceTimeout();
      clearDeadlineTimeout();
    };
  }, [clearDebounceTimeout, clearDeadlineTimeout]);

  return [immediateValue, debouncedValue, setValue, getValue];
}


/*

// This function is well tested, and without the deadline.
export function useDebouncer2<TValue = string | number>(initialValue: TValue, delayMs: number): [TValue, (newValue: TValue) => void, () => TValue] {
  const [debouncedValue, setDebouncedValue] = useState<TValue>(initialValue);
  const valueRef = useRef<TValue>(initialValue);
  const timeoutIdRef = useRef<number>();

  const clearDebounce = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = undefined;
    }
  }, []);

  const getCurrentValue = useCallback(() => valueRef.current, []);

  const setValue = useCallback((newValue: TValue) => {
    valueRef.current = newValue;
    clearDebounce();
    timeoutIdRef.current = window.setTimeout(
      () => setDebouncedValue(newValue),
      delayMs,
    );
  }, [clearDebounce, delayMs]);

  useEffect(() => {
    return clearDebounce;
  }, [clearDebounce]);

  return [debouncedValue, setValue, getCurrentValue];
}
*/