import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouterNode } from '~/server/api/trpc.router-node';
import { createTRPCFetchContext } from '~/server/api/trpc.server';

const handlerNodeRoutes = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc-node',
    router: appRouterNode,
    req,
    createContext: createTRPCFetchContext,
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => console.error(`❌ tRPC-node failed on ${path ?? 'unk-path'}: ${error.message}`)
        : undefined,
  });


// NOTE: the following statement breaks the build on non-pro deployments, and conditionals don't work either
//       so we resorted to raising the timeout from 10s to 25s in the vercel.json file instead
// export const maxDuration = 25;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { handlerNodeRoutes as GET, handlerNodeRoutes as POST };