import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouterNode } from '~/server/api/trpc.router-node';
import { createTRPCFetchContext } from '~/server/api/trpc.server';

const handlerNodeRoutes = (req: Request) =>
  fetchRequestHandler({
    router: appRouterNode,
    endpoint: '/api/trpc-node',
    req,
    createContext: createTRPCFetchContext,
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => console.error(`❌ tRPC-node failed on ${path ?? '<no-path>'}: ${error.message}`)
        : undefined,
  });

export const runtime = 'nodejs';

// the Browsing module has a timeout of ~10s, so we increase 15 (default) -> 25
// noinspection JSUnusedGlobalSymbols
export const maxDuration = process.env.VERCEL_SERVERLESS_MAX_DURATION ? parseInt(process.env.VERCEL_SERVERLESS_MAX_DURATION, 10) : undefined;
export const dynamic = 'force-dynamic';

export { handlerNodeRoutes as GET, handlerNodeRoutes as POST };