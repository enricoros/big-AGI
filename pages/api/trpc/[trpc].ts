import { NextRequest } from 'next/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouter } from '~/server/api/trpc.router';
import { createTRPCContext } from '~/server/api/trpc.server';


/*
// NextJS (traditional, non-edge) API handler

import { createNextApiHandler } from '@trpc/server/adapters/next';

export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError:
    process.env.NODE_ENV === 'development'
      ? ({ path, error }) => console.error(`❌ tRPC failed on ${path ?? '<no-path>'}:`, error)
      : undefined,
});
*/

export default async function handler(req: NextRequest) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    router: appRouter,
    req,
    createContext: createTRPCContext,
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => console.error(`❌ tRPC failed on ${path ?? '<no-path>'}:`, error)
        : undefined,
  });
}

// noinspection JSUnusedGlobalSymbols
export const runtime = 'edge';