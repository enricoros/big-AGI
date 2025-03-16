import type { MaybePromise } from '~/common/types/useful.types';

// configuration
// 12 messages per second works well for 60Hz displays (single chat has 1 message every 5 frames, and 24 in 4 chats, see the square root below)
const DECIMATOR_BASE_FPS = 12;
// we keep a space of at least 20ms between calls, to avoid blocking the UI; hopefully this is good for older systems too
const DECIMATOR_MIN_IDLE_MS = 20;
// minimum number of un-decimated calls -- IN ADDITION TO THE FIRST ONE (!)
const DECIMATOR_MIN_FREE_PASSES = 1;
// enable console logging
const DEBUG_DECIMATOR = false;


/**
 * Higher-order function that applies decimation to the provided callback.
 * Preserves the same signature as the input function.
 *
 * @param throttleUnits 0: disable, 1: default throttle (12Hz), 2+ reduce frequency with the square root
 * @param fn The function to be decimated
 * @returns A new function with the same signature that applies decimation
 */
export function withDecimator<T extends (...args: any[]) => MaybePromise<void>>(throttleUnits: number, fn: T): T {

  // pass though
  if (!throttleUnits) return fn;

  // 12 messages per second works well for 60Hz displays (single chat, and 24 in 4 chats, see the square root below)
  const unitDelayMs = 1000 / DECIMATOR_BASE_FPS;
  const intervalMs = !throttleUnits ? 0
    : throttleUnits > 1 ? Math.round(unitDelayMs * Math.sqrt(throttleUnits))
      : unitDelayMs;

  // state
  let creationTime = Date.now();
  let nextDeadline = creationTime - 1;
  let freePasses = DECIMATOR_MIN_FREE_PASSES;

  return (async (...args: Parameters<T>): Promise<void> => {

    const tStart = Date.now();

    // skip if early & out of free passes
    if (tStart < nextDeadline) {
      // skip
      if (freePasses <= 0) {
        if (DEBUG_DECIMATOR)
          console.log(` - ~decimate: SKIP, ${nextDeadline - tStart} left`);
        return;
      }

      // consume free pass
      freePasses--;
      if (DEBUG_DECIMATOR)
        console.log(` -  decimate: FREE PASS, ${freePasses} remaining`);
    }

    // run
    if (DEBUG_DECIMATOR)
      console.log(` - !decimate: CALL, ${tStart - nextDeadline} overtime, at ${tStart - creationTime}ms`);
    const retVal: void = await fn(...args);

    // schedule the next deadline
    const tStop = Date.now();
    const tElapsed = tStop - tStart;
    if (DEBUG_DECIMATOR)
      if (tElapsed > intervalMs)
        console.log(` - !decimate: WARNING, ${tElapsed - intervalMs}ms late (${tElapsed} > ${intervalMs})`);
    nextDeadline = Math.round(tStop + Math.max(intervalMs - tElapsed, DECIMATOR_MIN_IDLE_MS));

    return retVal;

  }) as T;

}
