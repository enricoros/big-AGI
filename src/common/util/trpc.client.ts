// noinspection JSUnresolvedReference

/**
 * This is the client-side entrypoint for your tRPC API. It is used to create the `api` object which
 * contains the Next.js App-wrapper, as well as your type-safe React Query hooks.
 *
 * We also create a few inference helpers for input and output types.
 */
import { createTRPCClient, httpLink, loggerLink, unstable_httpBatchStreamLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';

import type { AppRouterEdge } from '~/server/trpc/trpc.router-edge';
import type { AppRouterCloud } from '~/server/trpc/trpc.router-cloud';
import { transformer } from '~/server/trpc/trpc.transformer';

import { getBaseUrl } from './urlUtils';
import { reactQueryClientSingleton } from '../app.queryclient';


// configuration
const VERCEL_WORKAROUND_EDGE_1MB_PAYLOAD_LIMIT = true;


const enableLoggerLink = (opts: any) => {
  return process.env.NODE_ENV === 'development' ||
    (opts.direction === 'down' && opts.result instanceof Error);
};


/**
 * Typesafe React Query hooks for the tRPC Edge-Runtime API
 */
export const apiQuery = createTRPCNext<AppRouterEdge>({
  config() {
    return {
      /**
       * We set the queryClient to a singleton App-wide instance, to use the same client for
       * both React Query and tRPC. As `withTRPC` in _app.tsx, it will create a QueryClientProvider
       * component, so we can catch 2 birds with one stone and only create 1 provider, over 1
       * instance, and reuse the same configuration for both traditional React Query and tRPC.
       */
      queryClient: reactQueryClientSingleton(),
      links: [
        loggerLink({ enabled: enableLoggerLink }),
        httpLink({
          url: `${getBaseUrl()}/api/edge`,
          transformer: transformer,
          // You can pass any HTTP headers you wish here
          // async headers() {
          //   return {
          //     // authorization: getAuthCookie(),
          //   };
          // },
        }),
      ],
    };
  },
  /**
   * Whether tRPC should await queries when server rendering pages.
   * @see https://trpc.io/docs/client/nextjs/ssr
   */
  ssr: false,
  /**
   * Transformer used for data de-serialization from the server.
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: transformer,
});


/**
 * Typesafe async/await hooks for the the Edge-Runtime API
 */
export const apiAsync = createTRPCClient<AppRouterEdge>({
  links: [
    loggerLink({ enabled: enableLoggerLink }),
    httpLink({
      url: `${getBaseUrl()}/api/edge`,
      transformer: transformer,
    }),
  ],
});


/**
 * Stream API: uses tRPC streaming to transfer partial updates to the client
 */
export const apiStream = createTRPCClient<AppRouterEdge>({
  links: [
    loggerLink({ enabled: enableLoggerLink }),
    unstable_httpBatchStreamLink({
      url: `${getBaseUrl()}/api/edge`,
      transformer: transformer,
      /**
       * WORKAROUND:
       * Due to the fact that we are sending large payloads with images, and having a 1MB max payload size
       * limit on Vercel, we need to limit the number of items in the stream to 1, to err on the side of
       * safety.
       */
      ...(VERCEL_WORKAROUND_EDGE_1MB_PAYLOAD_LIMIT && { maxItems: 1 }),
    }),
  ],
});


/**
 * Node/Immediate API: Typesafe async/await hooks for the the Node functions API
 */
export const apiAsyncNode = createTRPCClient<AppRouterCloud>({
  links: [
    loggerLink({ enabled: enableLoggerLink }),
    httpLink({
      url: `${getBaseUrl()}/api/cloud`,
      transformer: transformer,
    }),
  ],
});
