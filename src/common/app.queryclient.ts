import { QueryClient } from '@tanstack/react-query';


let queryClient: QueryClient | null = null;

export function reactQueryClientSingleton(): QueryClient {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          // Fire fetches even when the browser thinks it's offline - the default 'online' mode would pause
          // them silently (Chromium's navigator.onLine/offline events have false negatives, see #334):
          // - localhost use: air-gapped machines must still reach 127.0.0.1 - own backend, Ollama, LocalAI
          // - sw offline use: [SW Offline] offline boot needs listInfo to fail fast, never pause (kb/systems/offline-pwa.md)
          // - electron interaction: a future desktop build is the same Chromium engine talking to local services - same requirement
          networkMode: 'always',
          refetchOnReconnect: false, // implied by networkMode: always
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
