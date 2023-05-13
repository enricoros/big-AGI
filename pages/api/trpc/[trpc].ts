import { createNextApiHandler } from '@trpc/server/adapters/next';

import { appRouter } from '~/modules/trpc/trpc.router';
import { createTRPCContext } from '~/modules/trpc/trpc.server';

// export API handler
export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError:
    process.env.NODE_ENV === 'development'
      ? ({ path, error }) => console.error(`❌ tRPC failed on ${path ?? '<no-path>'}:`, error)
      : undefined,
});