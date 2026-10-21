import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouterCloud } from '~/server/trpc/trpc.router-cloud';
import { createTRPCFetchContext } from '~/server/trpc/trpc.server';
import { posthogServerSendException } from '~/server/posthog/posthog.server';

// request bodies above this are rejected before parsing (largest payload: trade.storagePut)
const MAX_REQUEST_BODY_BYTES = 6 * 1024 * 1024;

const handlerNodeRoutes = async (req: Request) => {
  if (req.body) {
    const declaredLength = Number(req.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_REQUEST_BODY_BYTES)
      return _payloadTooLarge();

    // enforce on the actual bytes too, as chunked bodies carry no content-length
    const body = await _readBodyWithLimit(req.body, MAX_REQUEST_BODY_BYTES);
    if (!body)
      return _payloadTooLarge();
    req = new Request(req, { body });
  }
  return _trpcHandler(req);
};

const _payloadTooLarge = () => new Response('Payload Too Large', { status: 413 });

async function _readBodyWithLimit(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => null);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

const _trpcHandler = (req: Request) => fetchRequestHandler({
  endpoint: '/api/cloud',
  router: appRouterCloud,
  req,
  createContext: createTRPCFetchContext,
  onError: async function({ path, error, type, ctx }) {

    // -> DEV error logging
    if (process.env.NODE_ENV === 'development')
      console.error(`❌ tRPC-cloud failed on ${path ?? 'unk-path'}: ${error.message}`);

    // -> Capture node errors
    await posthogServerSendException(error, undefined, {
      domain: 'trpc-onerror',
      runtime: 'nodejs',
      endpoint: path ?? 'unknown',
      method: req.method,
      url: req.url,
      additionalProperties: {
        error_code: error.code,
        error_type: type,
      },
    });
  },
});


// NOTE: the following statement breaks the build on non-pro deployments, and conditionals don't work either
//       so we resorted to raising the timeout from 10s to 60s in the vercel.json file instead
// export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { handlerNodeRoutes as GET, handlerNodeRoutes as POST };