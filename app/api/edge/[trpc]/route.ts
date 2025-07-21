import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouterEdge } from '~/server/trpc/trpc.router-edge';
import { createTRPCFetchContext } from '~/server/trpc/trpc.server';
import { posthogCaptureServerException } from '~/server/posthog/posthog.server';

const handlerEdgeRoutes = (req: Request) => fetchRequestHandler({
  endpoint: '/api/edge',
  router: appRouterEdge,
  req,
  createContext: createTRPCFetchContext,
  onError: async function({ path, error, ctx, req, type }) {

    // -> DEV error logging
    if (process.env.NODE_ENV === 'development')
      console.error(`❌ tRPC-edge failed on ${path ?? 'unk-path'}: ${error.message}`);

    // -> Capture edge errors
    await posthogCaptureServerException(error, {
      runtime: 'edge',
      endpoint: path ?? 'unknown',
      method: req.method,
      url: req.url,
      additionalProperties: {
        errorCode: error.code,
        errorType: type,
      },
    });
  },
});

export const runtime = 'edge';
export { handlerEdgeRoutes as GET, handlerEdgeRoutes as POST };