import { createNextApiHandler } from '@trpc/server/adapters/next';

import { appRouterNode } from '~/server/api/trpc.router';
import { createTRPCNodeContext } from '~/server/api/trpc.server';

export default createNextApiHandler({
  router: appRouterNode,
  createContext: createTRPCNodeContext,
  onError:
    process.env.NODE_ENV === 'development'
      ? ({ path, error }) => console.error(`❌ tRPC-node failed on ${path ?? '<no-path>'}:`, error)
      : undefined,
});
