import * as React from 'react';

/**
 * Prevents the children from being rendered on the server.
 *
 * This is vital for using localStorage, which is not available on the server, and which
 * state is loaded synchronously on the client.
 *
 * The discrepancy between server and client state can cause hydration errors for React,
 * and we avoid those by using this wrapper.
 *
 * Suggestion: use sparingly, to show you are aware of the root causes of hydration errors.
 */
export const NoSSR = ({ children }: { children: any }): React.JSX.Element | null => {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => setIsMounted(true), []);

  return isMounted ? children : null;
};
