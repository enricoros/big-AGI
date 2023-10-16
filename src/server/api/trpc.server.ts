/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 */
// Former Context (for NextJS, non-edge-function)
// import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
// type CreateContextOptions = Record<string, never>;
// const createInnerTRPCContext = (_opts: CreateContextOptions) => {
//   return {};
// };
// export const createTRPCContext = (_opts: CreateNextContextOptions) => {
//   return createInnerTRPCContext({});
// };
// const t = initTRPC.context<typeof createTRPCContext>().create({

import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

export function createTRPCContext({ /*req, resHeaders*/ }: FetchCreateContextFnOptions) {
  // const user = { name: req.headers.get('username') ?? 'anonymous' };
  // return { req, resHeaders };
  return {};
}


/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get type safety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';


const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
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
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure;
