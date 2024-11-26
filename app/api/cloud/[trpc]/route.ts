import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouterCloud } from '~/server/trpc/trpc.router-cloud';
import { createTRPCFetchContext } from '~/server/trpc/trpc.server';

const handlerNodeRoutes = (req: Request) => fetchRequestHandler({
  endpoint: '/api/cloud',
  router: appRouterCloud,
  req,
  createContext: createTRPCFetchContext,
  onError:
    process.env.NODE_ENV === 'development'
      ? ({ path, error }) => console.error(`❌ tRPC-cloud failed on ${path ?? 'unk-path'}: ${error.message}`)
      : undefined,
});


// NOTE: the following statement breaks the build on non-pro deployments, and conditionals don't work either
//       so we resorted to raising the timeout from 10s to 25s in the vercel.json file instead
// export const maxDuration = 25;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { handlerNodeRoutes as GET, handlerNodeRoutes as POST };