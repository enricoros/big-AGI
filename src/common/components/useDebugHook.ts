import * as React from 'react';


// noinspection JSUnusedGlobalSymbols
/**
 * Useful for debugging React hooks.
 * - will show a stable unique Id, consistent during the lifetime of the component
 * - will show how many times the component has been rendered
 *   - note: increment is a bit misleading, as it's incremented globally for all components across all renders
 *   - although it's assigned to useRef, useRef will only remember the first value assigned to it
 */
export const useDebugHook = (app: string) => {

  // test behavior of React.useState - note the function syntax, so we don't call the initializer on every render
  const [hookId, setTest] = React.useState<number>(() => _getRandom1000());

  // test behavior of React.useRef with instance counter
  const testRef = React.useRef<number>(_increment(app));

  console.log(app, 'render', hookId, testRef.current);

  React.useEffect(() => {
    console.log(app, 'effect', hookId, testRef.current);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      console.log(app, 'cleanup', hookId, testRef?.current);
    };
  }, [app, hookId]);

  return { test: hookId, setTest };
};


let debugGlobalIncrement = 0;

function _increment(app: string) {
  const number = ++debugGlobalIncrement;
  console.log(`+increment: ${number} (${app})`);
  return number;
}

function _getRandom1000() {
  const number = Math.round(Math.random() * 1000);
  console.log(' ~random', number);
  return number;
}

