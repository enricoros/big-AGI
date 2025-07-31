import type { MaybePromise } from '~/common/types/useful.types';
import { Is } from '~/common/util/pwaUtils';

// configuration
// 20/15/12 messages per second works well for 60Hz displays (single chat has 1 message every 3/4/5 frames, and smooth scaling with square root for multiple chats)
const DECIMATOR_BASE_FPS = Is.Desktop ? 20 : 12; // fewer messages on mobile
// we keep a space of at least 20ms between calls, to avoid blocking the UI; hopefully this is good for older systems too
const DECIMATOR_MIN_IDLE_MS = 20;
// minimum number of un-decimated calls -- IN ADDITION TO THE FIRST ONE (!)
const DECIMATOR_MIN_FREE_PASSES = 2;
// enable console logging
const DEBUG_DECIMATOR = false;


/**
 * Higher-order function that applies decimation to the provided callback.
 * Preserves the same signature as the input function.
 *
 * @param throttleUnits 0: disable, 1: default throttle (20Hz desktop/12Hz mobile), 2+ reduce frequency with the square root
 * @param fn The function to be decimated
 * @returns A new function with the same signature that applies decimation
 */
export function withDecimator<T extends (...args: any[]) => MaybePromise<void>>(throttleUnits: number, fn: T): T {

  // pass though
  if (!throttleUnits) return fn;

  // Dynamic FPS works well for 60Hz displays (desktop: 20 FPS, mobile: 12 FPS, scaling with square root for multiple chats)
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
