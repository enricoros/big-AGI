import { QueryClient } from '@tanstack/react-query';


let queryClient: QueryClient | null = null;

export function reactQueryClientSingleton(): QueryClient {
  if (!queryClient) {
    queryClient = new QueryClient({
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
  return queryClient;
}
