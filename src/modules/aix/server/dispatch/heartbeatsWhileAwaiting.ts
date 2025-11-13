// configuration
const DEFAULT_TIMEOUT_MS = 10_000;


/**
 * Awaits a promise while sending ❤
 *
 * Maintains connection liveliness during long-running operations such as
 * long fetches (e.g. Anthropic on large context) or long reads (e.g.
 * image generation by Gemini Image).
 *
 * @param operationPromise Promise to await with heartbeat protection
 * @param timeoutMs Time in ms between heartbeats (if 0, no heartbeats)
 * @returns The same result as awaiting the promise
 */
export async function* heartbeatsWhileAwaiting<TOut>(operationPromise: Promise<TOut>, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  if (!timeoutMs) return await operationPromise;

  // holds the outcome in either state
  const operationWrapper = operationPromise
    .then(result => ({ type: 'resolved' as const, result }))
    .catch(error => ({ type: 'rejected' as const, error }));

  while (true) {

    // setup next ❤ timeout
    const heartbeatPromise = new Promise<'❤'>(resolve => {
      setTimeout(() => resolve('❤'), timeoutMs);
    });

    // race ❤|operation
    /**
     * Note: Vercel Edge Runtime infrastructure may log stack traces pointing here when ReadableStream fails
     * This is normal - the runtime error-logs where the operation was pending when the stream closed, independently from our error handling.
     */
    const winner = await Promise.race([
      operationWrapper,
      heartbeatPromise,
    ]);

    // if the operation won, great, we're done
    if (winner !== '❤')
      break;

    // otherwise send the ❤
    yield { p: '❤' as const };
  }

  // return the actual result (or throw if rejected)
  const wrappedResult = await operationWrapper;
  if (wrappedResult.type === 'rejected')
    throw wrappedResult.error;

  return wrappedResult.result;
}
