import type { MaybePromise } from '~/common/types/useful.types';
import { Is } from '~/common/util/pwaUtils';

// configuration
// 20/15/12 messages per second works well for 60Hz displays (single chat has 1 message every 3/4/5 frames, and smooth scaling with square root for multiple chats)
const DECIMATOR_BASE_FPS = Is.Desktop ? 15 : 12; // fewer messages on mobile
// we keep a space of at least 20ms between calls, to avoid blocking the UI; hopefully this is good for older systems too
const DECIMATOR_MIN_IDLE_MS = 20;
// minimum number of un-decimated calls (e.g. setting model name, or stats) -- IN ADDITION TO THE FIRST ONE (!)
const DECIMATOR_MIN_FREE_PASSES = 1;
// schedule deadline past the next allowed time to prefer sync updates
const DECIMATOR_DEADLINE_BUFFER_FACTOR = Is.Desktop ? 0.25 : 0.5;
// enable console logging
const DEBUG_DECIMATOR = false;


/**
 * Higher-order function that applies decimation to the provided callback.
 * Preserves the same signature as the input function.
 *
 * Enhanced to prevent lost updates with deadline scheduling for decimated calls.
 *
 * @param throttleUnits 0: disable, 1: default throttle (20Hz desktop/12Hz mobile), 2+ reduce frequency with the square root
 * @param debugErrorPrefix string to print if the wrapped function throws an error
 * @param fn The function to be decimated
 * @returns A new function with the same signature that applies decimation
 */
export function withDecimator<T extends (...args: any[]) => MaybePromise<void>>(throttleUnits: number, debugErrorPrefix: string, fn: T): T & { stop?: () => void } {

  // no decimation if throttle is disabled
  if (!throttleUnits) return fn;

  // Dynamic FPS works well for 60Hz displays (desktop: 20 FPS, mobile: 12 FPS, scaling with square root for multiple chats)
  const unitDelayMs = 1000 / DECIMATOR_BASE_FPS;
  const intervalMs = throttleUnits > 1 ? Math.round(unitDelayMs * Math.sqrt(throttleUnits)) : unitDelayMs;

  // state
  let creationTime = Date.now();
  let holdUntil = creationTime - 1;
  let freePasses = DECIMATOR_MIN_FREE_PASSES;
  let isDisposed = false;

  // deadline state
  let deadlineUntil = 0;
  let deadlineTimer: NodeJS.Timeout | null = null;
  let deadlineArgs: Parameters<T> | null = null;
  let deadlineContext: any = undefined; // preserve 'this' context

  const clearDeadline = () => {
    if (!deadlineTimer) return;
    deadlineUntil = 0;
    clearTimeout(deadlineTimer);
    deadlineTimer = null;
    deadlineArgs = null;
    deadlineContext = undefined;
  };

  const decimatedFn = (function(this: any, ...args: Parameters<T>): Promise<void> {
    if (isDisposed) return Promise.resolve();

    const tCall = Date.now();

    // SYNC CALL PATH: either past holding period or using free pass
    if (tCall >= holdUntil || freePasses > 0) {

      // clear pending deadline, if any
      clearDeadline();

      // consume free pass
      if (tCall < holdUntil) {
        freePasses--;
        // if (DEBUG_DECIMATOR)
        //   console.log(` -  decimate: FREE_PASS used, ${freePasses} remaining`);
      }

      // run
      if (DEBUG_DECIMATOR)
        console.log(` -> decimate: CALL, ${tCall >= holdUntil ? `${tCall - holdUntil}+` : `${tCall - holdUntil} FREE_PASS`}, at ${tCall - creationTime} ms`);
      
      // preserve 'this' context for sync calls
      const result = fn.call(this, ...args);
      
      // compute next hold time
      const tStop = Date.now();
      const tElapsed = tStop - tCall;
      if (DEBUG_DECIMATOR)
        if (tElapsed > intervalMs)
          console.log(` - !decimate: WARNING, ${tElapsed - intervalMs}ms late (${tElapsed} > ${intervalMs})`);
      holdUntil = Math.round(tStop + Math.max(intervalMs - tElapsed, DECIMATOR_MIN_IDLE_MS));

      return Promise.resolve(result);
    }

    // DEADLINE CALL PATH: schedule for later

    deadlineArgs = args;
    deadlineContext = this; // capture 'this' context

    // already scheduled, just update args and skip
    if (deadlineTimer) {
      if (DEBUG_DECIMATOR)
        console.log(` -  decimate: skip, ${holdUntil - tCall} AHEAD, ${deadlineUntil - tCall} to timer`);
      return Promise.resolve();
    }

    // schedule for post-hold execution, to prioritize sync updates
    deadlineUntil = holdUntil + Math.round(intervalMs * DECIMATOR_DEADLINE_BUFFER_FACTOR);
    const deadlineDelayMs = Math.max(deadlineUntil - tCall, DECIMATOR_MIN_IDLE_MS);

    deadlineTimer = setTimeout(async () => {
      if (isDisposed || !deadlineArgs) return;

      const tTimer = Date.now();
      if (DEBUG_DECIMATOR)
        console.log(` -> decimate: DEADLINE, ${tTimer - holdUntil} past nominal sync, at ${tTimer - creationTime} ms`);

      // clear deadline state
      const argsToEmit = deadlineArgs;
      const contextToUse = deadlineContext;
      deadlineUntil = 0;
      deadlineTimer = null;
      deadlineArgs = null;
      deadlineContext = undefined;

      // roll the holding time forward
      holdUntil = Math.round(tTimer + intervalMs);

      try {
        // preserve 'this' context for deadline calls
        await fn.call(contextToUse, ...argsToEmit);
      } catch (error) {
        // Log error with full context, but can't propagate to caller
        console.error(`${debugErrorPrefix} Error in deadline-scheduled function:`, error);
        console.error(`${debugErrorPrefix} This error occurred in a timer callback and cannot be caught by the caller`);
        
        // Could potentially store error for later retrieval or emit event
        // but for now, logging is the best we can do in timer context
      }
    }, deadlineDelayMs);
    if (DEBUG_DECIMATOR)
      console.log(` -  decimate: skip_SCHED->, ${holdUntil - tCall} AHEAD, in ${deadlineDelayMs} ms`);

    return Promise.resolve();

  }) as T & { stop?: () => void };

  /**
   * Stops any pending decimated updates to prevent out-of-order callbacks.
   *
   * Call before sending the final manual update to ensure the decimated
   * setTimeout doesn't fire after your final call completes.
   *
   * Safe to call multiple times.
   */
  decimatedFn.stop = () => {
    if (DEBUG_DECIMATOR && !isDisposed)
      console.log(deadlineTimer ? ` - !decimate: STOPPED, deadline scheduled for ${deadlineUntil - Date.now()} ms` : ' - decimate: STOPPED, no deadline scheduled');
    isDisposed = true;
    clearDeadline();
  };

  return decimatedFn;

}
