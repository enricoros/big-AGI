import * as React from 'react';


// set to false to disable the delay
const DEBUG_SIMULATE_DELAY: number | false = 50;


export function ProviderServerState(props: { children: React.ReactNode }) {
  const [loaded, setLoaded] = React.useState<boolean>(!DEBUG_SIMULATE_DELAY);

  // conditional network delay simulation
  React.useEffect(() => {
    if (loaded || !DEBUG_SIMULATE_DELAY) return;
    const timeout = setTimeout(() => {
      setLoaded(true);
    }, DEBUG_SIMULATE_DELAY);
    return () => clearTimeout(timeout);
  }, [loaded]);

  return loaded ? props.children : null;
}