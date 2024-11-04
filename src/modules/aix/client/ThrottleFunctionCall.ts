// [DEV] configuration
const DEBUG_DECIMATOR = false;
// 12 messages per second works well for 60Hz displays (single chat has 1 message every 5 frames, and 24 in 4 chats, see the square root below)
const DECIMATOR_BASE_FPS = 12;
// we keep a space of at least 20ms between calls, to avoid blocking the UI; hopefully this is good for older systems too
const DECIMATOR_MIN_IDLE_MS = 20;


/**
 * NOTE: due to its inline nature, and being used by the AIX client, keep the downstream lightweight! (don't let the 20ms emergency gap be necessary)
 *
 * This performs 2 kinds of decimations
 * - one is for events that come before the next horizon
 * - one is for events that are already queued up, and in case of functions exceeding
 *   the horizon (the DECIMATOR_MIN_IDLE_MS tries to eat up buffered calls)
 */
export class ThrottleFunctionCall {
  private readonly nextIntervalMs: number;
  private nextExecutionStartTime: number;

  /**
   * @param throttleUnits 0: disable, 1: default throttle (12Hz), 2+ reduce frequency with the square root
   */
  constructor(throttleUnits: number) {
    // 12 messages per second works well for 60Hz displays (single chat, and 24 in 4 chats, see the square root below)
    const baseDelayMs = 1000 / DECIMATOR_BASE_FPS;
    this.nextIntervalMs = throttleUnits === 0 ? 0
      : throttleUnits > 1 ? Math.round(baseDelayMs * Math.sqrt(throttleUnits))
        : baseDelayMs;
    this.nextExecutionStartTime = Date.now();
  }

  decimate(decimatedFunction: () => void): void {
    const now = Date.now();

    // skip if it's not time yet
    if (now < this.nextExecutionStartTime) {
      if (DEBUG_DECIMATOR)
        console.warn(` - ~decimate: SKIP, ${this.nextExecutionStartTime - now} remaining`);
      return;
    }

    // it's time, execute the function
    if (DEBUG_DECIMATOR)
      console.warn(` - !decimate: CALL, ${now - this.nextExecutionStartTime} overtime`);
    decimatedFunction();

    // schedule the next call
    const endNow = Date.now();
    const elapsed = endNow - now;
    if (DEBUG_DECIMATOR)
      if (elapsed > this.nextIntervalMs)
        console.warn(` - !decimate: WARNING, ${elapsed - this.nextIntervalMs}ms late (${elapsed} > ${this.nextIntervalMs})`);
    this.nextExecutionStartTime = Math.round(endNow + Math.max(this.nextIntervalMs - elapsed, DECIMATOR_MIN_IDLE_MS));
  }

}
