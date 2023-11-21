// noinspection JSUnresolvedReference

/**
 * This is the client-side entrypoint for your tRPC API. It is used to create the `api` object which
 * contains the Next.js App-wrapper, as well as your type-safe React Query hooks.
 *
 * We also create a few inference helpers for input and output types.
 */
import { createTRPCProxyClient, httpBatchLink, httpLink, loggerLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
import superjson from 'superjson';

import type { AppRouterEdge } from '~/server/api/trpc.router-edge';
import type { AppRouterNode } from '~/server/api/trpc.router-node';

import { getBaseUrl } from './urlUtils';


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
       * Transformer used for data de-serialization from the server.
       *
       * @see https://trpc.io/docs/data-transformers
       */
      transformer: superjson,

      /**
       * Links used to determine request flow from client to server.
       *
       * @see https://trpc.io/docs/links
       */
      links: [
        loggerLink({ enabled: enableLoggerLink }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc-edge`,
        }),
      ],
    };
  },
  /**
   * Whether tRPC should await queries when server rendering pages.
   *
   * @see https://trpc.io/docs/nextjs#ssr-boolean-default-false
   */
  ssr: false,
});


/**
 * Typesafe async/await hooks for the the Edge-Runtime API
 */
export const apiAsync = createTRPCProxyClient<AppRouterEdge>({
  transformer: superjson,
  links: [
    loggerLink({ enabled: enableLoggerLink }),
    httpLink({
      url: `${getBaseUrl()}/api/trpc-edge`,
    }),
  ],
});


/**
 * Node/Immediate API: Typesafe async/await hooks for the the Node functions API
 */
export const apiAsyncNode = createTRPCProxyClient<AppRouterNode>({
  transformer: superjson,
  links: [
    loggerLink({ enabled: enableLoggerLink }),
    httpLink({
      url: `${getBaseUrl()}/api/trpc-node`,
    }),
  ],
});

