import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';


export function ProviderTRPCQueryClient(props: { children: React.ReactNode }) {
  // single app-wide instance, used by both React Query and tRPC
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // call functions even when the network is disconnected; this makes 127.0.0.1 work, while probably not causing other issues
        networkMode: 'always',
        // not tested yet, but they could be good defaults
        // refetchOnWindowFocus: false,
        // refetchOnMount: false,
      },
      mutations: {
        retry: false,
        networkMode: 'always',
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  );
}