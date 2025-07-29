import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouterCloud } from '~/server/trpc/trpc.router-cloud';
import { createTRPCFetchContext } from '~/server/trpc/trpc.server';
import { posthogCaptureServerException } from '~/server/posthog/posthog.server';

const handlerNodeRoutes = (req: Request) => fetchRequestHandler({
  endpoint: '/api/cloud',
  router: appRouterCloud,
  req,
  createContext: createTRPCFetchContext,
  onError: async function({ path, error, type, ctx }) {

    // -> DEV error logging
    if (process.env.NODE_ENV === 'development')
      console.error(`❌ tRPC-cloud failed on ${path ?? 'unk-path'}: ${error.message}`);

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


// NOTE: the following statement breaks the build on non-pro deployments, and conditionals don't work either
//       so we resorted to raising the timeout from 10s to 60s in the vercel.json file instead
export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { handlerNodeRoutes as GET, handlerNodeRoutes as POST };