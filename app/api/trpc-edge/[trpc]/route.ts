import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouterEdge } from '~/server/api/trpc.router';
import { createTRPCFetchContext } from '~/server/api/trpc.server';

const handlerEdgeRoutes = (req: Request) =>
  fetchRequestHandler({
    router: appRouterEdge,
    endpoint: '/api/trpc-edge',
    req,
    createContext: createTRPCFetchContext,
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => console.error(`❌ tRPC-edge failed on ${path ?? '<no-path>'}:`, error)
        : undefined,
  });

export const runtime = 'edge';
export { handlerEdgeRoutes as GET, handlerEdgeRoutes as POST };