import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';


export function ProviderTRPCQueryClient(props: { children: React.ReactNode }) {
  // single app-wide instance, used by both React Query and tRPC
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  );
}