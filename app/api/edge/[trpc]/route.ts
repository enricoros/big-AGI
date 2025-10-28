import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouterEdge } from '~/server/trpc/trpc.router-edge';
import { createTRPCFetchContext } from '~/server/trpc/trpc.server';
import { posthogCaptureServerException } from '~/server/posthog/posthog.server';

const handlerEdgeRoutes = (req: Request) => fetchRequestHandler({
  endpoint: '/api/edge',
  router: appRouterEdge,
  req,
  createContext: createTRPCFetchContext,
  onError: async function({ path, error, type, ctx }) {

    // -> DEV error logging
    if (process.env.NODE_ENV === 'development')
      console.error(`❌ tRPC-edge failed on ${path ?? 'unk-path'}: ${error.message}`);

    // -> Capture node errors
    await posthogCaptureServerException(error, {
      domain: 'trpc-onerror',
      runtime: 'nodejs',
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

// PATCH: Switch from edge to nodejs runtime to avoid Vercel's 5-minute timeout
// This sacrifices edge performance (speed, global distribution) for reliability
// with slower models like GPT-5 Pro that can take >5 minutes to respond.
// maxDuration: 600 seconds (10 minutes) - maximum for Vercel Pro plans
// For longer durations, consider Vercel Enterprise or alternative hosting.
export const maxDuration = 600;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { handlerEdgeRoutes as GET, handlerEdgeRoutes as POST };