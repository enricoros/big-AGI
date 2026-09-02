import { onlineManager } from '@tanstack/react-query';

import { isBrowser } from '~/common/util/pwaUtils';

// configuration
const DEBUG_NETSTATE = false; // logs every signal, seed and heal via console (the logger barrel imports this module - no logger here)

/**
 * netstate - the single home for browser connectivity signals.
 *
 * Philosophy (#334: Chromium's navigator.onLine and offline events have false negatives):
 * signals are nudges and hints, never truth - truth is the outcome of attempting. Semantics:
 *
 * - fire regardless:    queryclient `networkMode: 'always'` - fetches never pause on a signal
 * - wake nudge:         netStateSubscribeWake() - "re-check your real status now"; consumers coalesce
 * - online hint:        netStateOnlineHint()/netStateSubscribeOnlineHint() - for scheduling and
 *                       UI, never a gate on user-initiated operations; evidence overrides it
 * - definitely offline: netStateIsBrowserOffline() - one-shot, only where both error directions are safe
 *
 * The hint state IS TanStack's `onlineManager`, with detection owned HERE: netStateInstall()
 * (called once by reactQueryClientSingleton, before any query exists) takes over its event
 * listening via the public setEventListener and seeds a definite browser offline claim - one
 * store, shared with react-query, so reachability evidence also re-fires `refetchOnReconnect: true`
 * queries. The seed is safe both ways: a false claim heals on the first evidence - producers are
 * the transports' success paths (server contact, socket connect, inbound broadcast). Electron
 * rides the same policy: its Chromium events are equally corrigible.
 */


/** Why a wake nudge fired: the browser's 'online' edge, or the document becoming visible again. */
export type NetStateWakeReason = 'online' | 'visible';


let _installed = false;

/**
 * Take ownership of onlineManager's event detection (idempotent, no-op on the server).
 * Called once by reactQueryClientSingleton() - synchronously installs the online/offline
 * listeners (setEventListener runs the setup immediately and keeps it for any later
 * subscriber cycle), then seeds once: an offline boot gets no transition event, so the
 * optimistic default would never pause. Never re-seeded toward online - evidence-healed
 * state must win; only a DEFINITE offline claim is re-adopted, on the wake edge.
 */
export function netStateInstall(): void {
  if (_installed || !isBrowser) return;
  _installed = true;
  onlineManager.setEventListener((setOnline) => {
    const onOnline = () => {
      DEBUG_NETSTATE && console.log('[netstate] event: online');
      setOnline(true);
    };
    const onOffline = () => {
      DEBUG_NETSTATE && console.log('[netstate] event: offline');
      setOnline(false);
    };
    // wake parity: sleep/wake can update navigator.onLine without firing an event - on becoming
    // visible, re-adopt a DEFINITE offline claim (safe direction only; a false claim is healed by
    // the same wake's focus refetch). Replaces the old resume-time navigator.onLine re-read.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const readopt = navigator.onLine === false;
      DEBUG_NETSTATE && console.log(`[netstate] wake: visible, onLine=${navigator.onLine}${readopt ? ' -> re-adopt offline' : ''}`);
      if (readopt)
        setOnline(false);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });
  DEBUG_NETSTATE && console.log(`[netstate] install: navigator.onLine=${navigator.onLine} -> ${navigator.onLine === false ? 'seed offline' : 'optimistic'}`);
  if (navigator.onLine === false)
    onlineManager.setOnline(false);
}


/**
 * One-shot, safe-direction read: true only when the browser POSITIVELY reports no connectivity.
 * Only for spots where both error directions are harmless - never to gate or pause an operation.
 */
export function netStateIsBrowserOffline(): boolean {
  return isBrowser && navigator.onLine === false;
}


/** Optimistic online hint - event-edge state, corrected by netStateReportReachable() evidence. */
export function netStateOnlineHint(): boolean {
  return onlineManager.isOnline();
}

/** Subscribe to online hint edges. Does not fire on subscribe - seed with netStateOnlineHint(). */
export function netStateSubscribeOnlineHint(callback: (online: boolean) => void): () => void {
  return onlineManager.subscribe(callback);
}

/**
 * Reachability evidence: real traffic proves the network works, whatever the browser believes -
 * flips the hint true, un-pausing its consumers and firing reconnect refetches. Success evidence
 * only (failure classification is false-positive-prone), and throw-safe by contract: producers
 * run inside SDK callbacks, so the synchronous subscriber fan-out must never break them.
 */
export function netStateReportReachable(): void {
  try {
    DEBUG_NETSTATE && !onlineManager.isOnline() && console.log('[netstate] evidence: reachable -> heal to online');
    onlineManager.setOnline(true); // no-op when already true
  } catch (error) {
    console.warn('[netstate] reachability fan-out error:', error);
  }
}


/**
 * Wake nudges: the 'online' edge plus visibilitychange-to-visible (sleep/wake with an unchanged
 * network config often fires no 'online'). A nudge means "re-check", never "the network is up";
 * both edges can fire together, consumers coalesce. Listeners are per-subscription and bind at
 * call time (SSR-safe, test-fake friendly).
 */
export function netStateSubscribeWake(callback: (reason: NetStateWakeReason) => void): () => void {
  if (!isBrowser) return () => undefined;
  const onOnline = () => {
    DEBUG_NETSTATE && console.log('[netstate] wake nudge: online');
    callback('online');
  };
  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    DEBUG_NETSTATE && console.log('[netstate] wake nudge: visible');
    callback('visible');
  };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
