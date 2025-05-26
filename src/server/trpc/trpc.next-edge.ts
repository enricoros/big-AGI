/// Next.js Edge Runtime check - won't activate otherwise
declare global {
  // noinspection ES6ConvertVarToLetConst
  var EdgeRuntime: string | undefined;
}

/**
 * 2025-05-22: Workaround an issue that appeared in all Vercel deployments.
 * https://github.com/enricoros/big-AGI/issues/805
 *
 * This is an emergency workaround for the 'Stream closed' issue, while the 6 Exceptions are still
 * thrown on each tRPC call.
 *
 * Analysis:
 * - the server side saw the following exceptions on Vercel, during the call to this server-side tRPC
 *   streaming chatGenerateContent function:
 *
 *   TypeError: Cannot read properties of undefined (reading 'return')
 *     at (node_modules/@trpc/server/dist/unstable-core-do-not-import/stream/utils/disposable.mjs:38:0)
 *     at (node_modules/@trpc/server/dist/unstable-core-do-not-import/stream/jsonl.mjs:204:0)
 *
 * - we haven't isolated the cause, but seems that awaiting for the next event loop cycle suppresses
 *   the issue.
 *
 * Ext refs: posted to the tRCP Discord on the streaming channel if anyone else saw this issue.
 */
export function delayPostAsyncGeneratorOnEdge<TArgs, TYield>(
  delayMs: number,
  originalAsyncGeneratorFn: (args: TArgs) => AsyncGenerator<TYield>,
): (args: TArgs) => AsyncGenerator<TYield> {
  return async function* wrappedAsyncGenerator(args: TArgs): AsyncGenerator<TYield> {

    yield* originalAsyncGeneratorFn(args);

    // [EdgeRuntime]
    if (typeof EdgeRuntime === 'string') {
      if (delayMs >= 0)
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // explicitly return void
    return;
  };
}
