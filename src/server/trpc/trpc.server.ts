/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import * as z from 'zod/v4';
import { initTRPC } from '@trpc/server';
import { transformer } from './trpc.transformer';
import { TRPCFetcherError } from './trpc.router.fetchers';


/**
 * Type of the Context object passed to procedures/resolvers, to avoid circular dependencies.
 */
export type ChatGenerateContentContext = Awaited<ReturnType<typeof createTRPCFetchContext>>;


/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 */
export const createTRPCFetchContext = async ({ req }: FetchCreateContextFnOptions) => {
  // const user = { name: req.headers.get('username') ?? 'anonymous' };
  // return { req, resHeaders };
  return {
    // only used by Backend Analytics
    hostName: req.headers?.get('host') ?? 'localhost',
    // enables cancelling upstream requests when the downstream request is aborted
    reqSignal: req.signal,
  };
};


/**
 * 2. SERVER-SIDE INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCFetchContext>().create({
  // server transformer - serialize: -> client, deserialize: <- client
  transformer: transformer,
  errorFormatter({ shape, error }) {

    // Important: remove the 'stack' from the error data to avoid leaking internals and shorten the payload
    const { stack, ...nonStackData } = shape.data;

    // Enable client-side decisions: communicate fetcher/network error details downstream
    const fetcherError = error instanceof TRPCFetcherError ? {
      aixFCategory: error.category,
      aixFHttpStatus: error.httpStatus ?? null,
      aixFNetError: error.connErrorName ?? null,
    } : {};

    return {
      ...shape,
      data: {
        ...nonStackData,
        ...fetcherError,
        zodError:
          error.cause instanceof z.ZodError ? z.treeifyError(error.cause) : null,
      },
    };
  },
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @link https://trpc.io/docs/v11/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unprotected) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 *
 * @link https://trpc.io/docs/v11/procedures
 */
export const publicProcedure = t.procedure;

/**
 * Edge procedures for the AI inference Edge network:
 * - AIX streaming endpoints
 * - specific endpoints: Anthropic, Gemini, Ollama, OpenAI
 *
 * Open for now, as these are pass-through with service keys inside the request usually.
 * May be closed in the future if key material is on the server-side procedure, in which case
 * authentication will be required.
 */
export const edgeProcedure = t.procedure;

// /**
//  * Create a server-side caller
//  * @link https://trpc.io/docs/v11/server/server-side-calls
//  */
// export const createCallerFactory = t.createCallerFactory;
