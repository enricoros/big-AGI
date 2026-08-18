import { Is, isBrowser } from '~/common/util/pwaUtils';
import { getLabsScreenWakeLock } from '~/common/stores/store-ux-labs';


/**
 * Screen Wake Lock - keeps the display on while generations run, because a locked phone screen kills
 * in-flight streams. Ref-counted: one OS lock, held while any holder is alive (+ a short linger so
 * back-to-back generations and tool gaps don't churn it).
 *
 * Mobile only, Labs `labsScreenWakeLock` (default on, no UI). No-op on desktop, SSR, unsupported
 * browsers (note: iOS home-screen apps only since iOS 18.4). Only prevents screen-off: app switch and
 * the power button still hide the page, the browser releases the lock (re-acquired on visible if
 * still held) and suspends the page - surviving that needs upstream resumability, not a lock.
 *
 * Usage: `const release = wakeLockHold('label'); try { ... } finally { release(); }`
 * AIX holds one per LL generation; a unified chat/agent loop should hold one for its whole run.
 */

const DEBUG_WAKE_LOCK = false;
const _LINGER_MS = 2500;

// iPadOS sends a Mac UA - touch points tell it apart (real Macs report 0)
const _isEnabled = isBrowser && 'wakeLock' in navigator && (!Is.Desktop || (Is.OS.MacOS && navigator.maxTouchPoints > 1));

let _holders = 0;
let _wanted = false; // holders > 0, or lingering
let _sentinel: WakeLockSentinel | null = null;
let _requesting = false;
let _lingerTimer: ReturnType<typeof setTimeout> | null = null;

// the browser releases the lock on hide; re-acquire on visible
if (_isEnabled)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && _wanted)
      void _sync();
  });


/**
 * Holds the screen wake lock until the returned function is called (idempotent). No-op off-policy.
 */
export function wakeLockHold(label: string): () => void {
  if (!_isEnabled || !getLabsScreenWakeLock())
    return _noop;

  _holders++;
  _wanted = true;
  if (_lingerTimer) {
    clearTimeout(_lingerTimer);
    _lingerTimer = null;
  }
  if (DEBUG_WAKE_LOCK) console.log(`[DEV] wakeLock: hold '${label}' (${_holders})`);
  void _sync();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    _holders--;
    if (DEBUG_WAKE_LOCK) console.log(`[DEV] wakeLock: release '${label}' (${_holders})`);
    if (_holders > 0) return;
    _lingerTimer = setTimeout(() => {
      _lingerTimer = null;
      _wanted = false;
      void _sync();
    }, _LINGER_MS);
  };
}

function _noop() {
}

// reconciles the OS lock with `_wanted`; safe to call any time
async function _sync() {
  if (!_wanted) {
    if (_sentinel) {
      void _sentinel.release();
      _sentinel = null;
    }
    return;
  }
  if (_sentinel || _requesting || document.visibilityState !== 'visible')
    return; // hidden: requests are refused, visibilitychange retries
  _requesting = true;
  try {
    const sentinel = await navigator.wakeLock.request('screen');
    _sentinel = sentinel;
    sentinel.addEventListener('release', () => {
      if (_sentinel === sentinel) _sentinel = null; // released by the browser (hide, low battery): drop our ref
      if (DEBUG_WAKE_LOCK) console.log('[DEV] wakeLock: released');
    });
    if (DEBUG_WAKE_LOCK) console.log('[DEV] wakeLock: acquired');
  } catch (error: any) {
    // NotAllowedError (hidden, permissions policy, low battery): stay silent, the next hold or visibility retries
    if (DEBUG_WAKE_LOCK) console.log('[DEV] wakeLock: refused', error?.name, error?.message);
  } finally {
    _requesting = false;
  }
  if (!_wanted) void _sync(); // holders left while awaiting
}
