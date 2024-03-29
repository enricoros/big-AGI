import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';


export function ProviderTRPCQuerySettings(props: { children: React.ReactNode }) {

  // single app-wide instance, used by both React Query and tRPC
  const queryClientRef = React.useRef<QueryClient | null>(null);

  // create the instance if it doesn't exist
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          // call functions even when the network is disconnected; this makes 127.0.0.1 work, while probably not causing other issues
          networkMode: 'always',
          refetchOnWindowFocus: false,
        },
        mutations: {
          retry: false,
          networkMode: 'always',
        },
      },
    });
  }

  return (
    <QueryClientProvider client={queryClientRef.current}>
      {props.children}
    </QueryClientProvider>
  );
}