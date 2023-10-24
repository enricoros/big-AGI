import { NextRequest } from 'next/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouterEdge } from '~/server/api/trpc.router';
import { createTRPCEdgeContext } from '~/server/api/trpc.server';

export default async function handler(req: NextRequest) {
  // NOTE: the `fetchRequestHandler` will find the path by subtracting the `endpoint` (base) from the request URL
  //       i.e.: this nextjs file can have any name, contrary to the nodejs pages router rile
  return fetchRequestHandler({
    endpoint: '/api/trpc-edge',
    router: appRouterEdge,
    req,
    createContext: createTRPCEdgeContext,
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => console.error(`❌ tRPC-edge failed on ${path ?? '<no-path>'}:`, error)
        : undefined,
  });
}

// Run on the EDGE runtime
// noinspection JSUnusedGlobalSymbols
export const runtime = 'edge';