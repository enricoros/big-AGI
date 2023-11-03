import * as React from 'react';

let instanceCounter = 0;

function getRandom1000() {
  const number = Math.round(Math.random() * 1000);
  console.log('~random', number);
  return number;
}

function increment() {
  const number = instanceCounter++;
  console.log('+increment', number);
  return number;
}

export const useDebugHook = (app: string) => {
  // test behavior of React.useState - note the function syntax, so we don't call the initializer on every render
  const [test, setTest] = React.useState<number>(() => getRandom1000());
  // test behavior of React.useRef with instance counter
  const testRef = React.useRef<number>(increment());

  console.log(app, 'render', test, testRef.current);

  React.useEffect(() => {
    console.log(app, 'effect', test, testRef.current);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      console.log(app, 'cleanup', test, testRef?.current);
    };
  }, [app, test]);

  return { test, setTest };
};