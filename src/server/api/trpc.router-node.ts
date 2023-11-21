import { createTRPCRouter } from './trpc.server';

import { tradeRouter } from '~/modules/trade/server/trade.router';

/**
 * Secondary rooter, and will be sitting on an NodeJS Runtime.
 */
export const appRouterNode = createTRPCRouter({
  trade: tradeRouter,
});

// export type definition of API
export type AppRouterNode = typeof appRouterNode;