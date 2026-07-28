import * as React from 'react';

import { Release } from '~/common/app.release';
import { posthogCaptureEvent } from '~/common/components/3rdparty/PostHogAnalytics';

import { type LocalActiveWorkSnapshot, localActiveWorkGet } from './localActiveWork';


/**
 * Single-instance enforcement.
 *
 * The leadership decision is made by the browser (Web Locks), not by talking to other tabs:
 *  - atomic: two tabs racing cannot both win, there's no probe/cutoff guessing
 *  - fast: the verdict lands in ~1 lock round-trip, claimed lazily on the gate provider's first render
 *  - crash-safe: the browser releases the lock when the context dies (close, crash, OOM, discard)
 *  - queued: a waiting tab is promoted the instant the holder goes away, no heartbeat, no stale timeout
 *
 * The BroadcastChannel survives, demoted to metadata + commands only (peer work summary, build version,
 * 'please hand over'). It never decides who runs. Steady state with a single tab is zero traffic.
 *
 * Fallback: `navigator.locks` is secure-context only, so a self-hosted app on plain http (e.g. a LAN IP)
 * uses a probe/cutoff over the same channel. Best-effort by nature - see `_legacy*` below.
 */

// configuration
const LOCK_NAME = 'big-agi-instance';
const CHANNEL_NAME = 'big-agi-tabs';
const PEER_POLL_MS = 2000; // follower -> leader state poll, only while the follower is visible
const PEER_UNRESPONSIVE_MS = 6000; // no reply for this long: the other window is frozen or gone
const TRANSFER_GRACE_MS = 2500; // wait for a cooperative hand-over before taking the lock by force
const LEGACY_PROBE_MS = 350; // fallback only: how long to wait for a peer to answer
const DEMOTE_WIPE_DELAY_MS = 150; // post-flush margin for React to commit the unmount before the wipe
/**
 * What a demoted leader becomes after the wipe. Either way its JS realm dies - that is the release
 * (module singletons keep the heap and even the mic alive past any unmount; only realm death frees them):
 * - 'closed-page': maximum wipe - the inert, zero-JS static /closed.html; no auto-promotion, no re-entry
 * - 'takeover-screen': wipe-reload into the lightweight follower screen; can transfer back / auto-promote
 */
const DEMOTE_INTO: 'closed-page' | 'takeover-screen' = 'closed-page';


export type InstanceRole = 'leader' | 'follower';

export interface InstancePeerInfo {
  work: LocalActiveWorkSnapshot | null;
  buildTimestamp: string | null;
  responsive: boolean;
}

export interface InstanceState {
  /** null while undecided: sub-ms with Web Locks, up to LEGACY_PROBE_MS on the fallback */
  role: InstanceRole | null;
  /** the other instance, while we're a follower */
  peer: InstancePeerInfo | null;
  /** demote wipe pending: this realm is about to be destroyed, so transfer into it is disabled */
  wiping: boolean;
}

type ChannelMessage =
  | { t: 'PING' } // follower -> leader: what are you doing?
  | { t: 'STATE'; work: LocalActiveWorkSnapshot | null; build?: string } // leader -> follower
  | { t: 'YIELD' } // follower -> leader: please hand over
  | { t: 'READY' } // leader -> follower: flushed, take it
  | { t: 'PROBE' } // legacy: anybody holding?
  | { t: 'HERE' } // legacy: leader answers a probe, or announces its own promotion
  | { t: 'BYE' }; // legacy: leader stepping down or leaving


class InstanceLockManager {

  // decision state
  private _role: InstanceRole | null = null;
  private _peer: InstancePeerInfo | null = null;
  private _wiping = false;
  private _snapshot: InstanceState;

  // web locks
  private readonly _useLocks: boolean;
  private _queueAbort: AbortController | null = null;
  private _lockErrors = 0;

  // channel
  private _channel: BroadcastChannel | null = null;
  private _pollTimer: ReturnType<typeof setInterval> | undefined;
  private _transferTimer: ReturnType<typeof setTimeout> | undefined;
  private _lastPeerReplyAt = 0;

  // legacy fallback
  private _legacyTimer: ReturnType<typeof setTimeout> | undefined;
  private _legacySawPeer = false;

  private readonly _subs = new Set<(state: InstanceState) => void>();
  private readonly _flushers = new Set<() => Promise<void>>();


  constructor() {
    this._useLocks = typeof navigator !== 'undefined' && !!navigator.locks;
    this._snapshot = this._buildSnapshot();

    if (typeof BroadcastChannel !== 'undefined') {
      this._channel = new BroadcastChannel(CHANNEL_NAME);
      this._channel.onmessage = (event: MessageEvent<ChannelMessage>) => this._onMessage(event.data);
    }

    // no arbiter and no channel (ancient engines): nothing to coordinate with, run as the only instance
    if (this._useLocks)
      this._lockClaim();
    else if (this._channel) {
      console.log('[single-tab] Web Locks unavailable (non-secure context): single-instance enforcement is best-effort');
      this._legacyClaim();
    } else
      this._becomeLeader();
  }


  // public API

  getState(): InstanceState {
    return this._snapshot;
  }

  subscribe(callback: (state: InstanceState) => void): () => void {
    this._subs.add(callback);
    callback(this._snapshot);
    return () => this._subs.delete(callback);
  }

  /** storage providers register these: pending writes must reach disk before we hand over; returns the unregister */
  addFlusher(flusher: () => Promise<void>): () => void {
    this._flushers.add(flusher);
    return () => void this._flushers.delete(flusher);
  }

  async #flush(): Promise<void> {
    await Promise.all([...this._flushers].map(async (flusher) =>
      flusher().catch((error) => console.warn('[single-tab] flush failed:', error)))
    );
  }

  /** follower: ask the leader to hand over, and take it by force if it doesn't answer in time */
  requestTransfer(): void {
    // a wiping realm must never be re-promoted: its stale in-memory state would resume over what the
    // new leader persisted, and the already-armed wipe would then destroy the re-promoted tab
    if (this._role !== 'follower' || this._wiping) return;
    this._post({ t: 'YIELD' });
    clearTimeout(this._transferTimer);
    this._transferTimer = setTimeout(() => {
      // the other window never answered (frozen, wedged, or gone): take the instance from it
      this._takeOver();
    }, TRANSFER_GRACE_MS);
  }

  // hand-over (cooperative via YIELD/READY, forced via steal)

  /** leader: flush, then tell the asker it can take over */
  private async _handOver(): Promise<void> {
    if (this._role !== 'leader') return;

    // pending debounced writes must land before another tab opens the same database
    await this.#flush();
    if (this._role !== 'leader') return; // taken from us while flushing

    // the asker takes it directly (deterministic), rather than us releasing into a FIFO queue
    // that could promote a third window instead
    if (this._useLocks) {
      this._post({ t: 'READY' });
    } else {
      this._post({ t: 'BYE' });
      this._becomeFollower();
    }
  }

  /** follower: become the instance now, taking it from whoever holds it */
  private _takeOver(): void {
    if (this._role === 'leader') return;
    clearTimeout(this._transferTimer);
    this._transferTimer = undefined;
    if (this._useLocks) this._lockSteal();
    else this._legacyPromote(0);
  }


  // web locks backend

  /** atomic 'am I first?' - the browser decides, no peer needs to be alive or responsive */
  private _lockClaim(): void {
    navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
      if (!lock) return; // someone else holds it: authoritative, no guessing
      return this._hold(); // never settles while we are the instance
    })
      .then(() => this._becomeFollower()) // only reachable when not granted
      .catch(() => this._onHoldLost());
  }

  /** wait in the FIFO queue: granted the instant the holder goes away (close, crash, yield, steal) */
  private _lockEnqueue(): void {
    if (this._queueAbort) return; // already waiting
    if (this._lockErrors > 3) return; // the lock manager keeps failing: stop retrying, stay a follower
    const abort = new AbortController();
    this._queueAbort = abort;
    navigator.locks.request(LOCK_NAME, { signal: abort.signal }, () => this._hold())
      .catch((error: Error) => {
        // never leave a follower without a queued request, or it would never be promoted again
        if (this._queueAbort === abort) this._queueAbort = null;
        if (abort.signal.aborted) return; // we dropped our place on purpose (steal path)
        if (error?.name !== 'AbortError') this._lockErrors++; // 'AbortError' = stolen from us, which is normal
        this._onHoldLost();
      });
  }

  /** take the lock from an unresponsive holder: their request rejects and they become a follower */
  private _lockSteal(): void {
    this._queueAbort?.abort(); // drop our place in the queue first, or we'd be granted it again later
    this._queueAbort = null;
    navigator.locks.request(LOCK_NAME, { steal: true }, () => this._hold())
      .catch(() => this._onHoldLost());
  }

  private _hold(): Promise<void> {
    this._queueAbort = null; // we're the holder now, not a waiter
    this._lockErrors = 0;
    this._becomeLeader();
    // holding the lock IS being the instance: this settles only when another window takes it
    // (steal -> AbortError) or when this context dies (the browser releases it for us)
    return new Promise<void>(() => { /* never */ });
  }

  private _onHoldLost(): void {
    // another window stole the lock (AbortError), or the request failed unexpectedly
    this._becomeFollower();
  }


  // legacy fallback (non-secure contexts only: no navigator.locks)

  private _legacyClaim(): void {
    this._legacySawPeer = false;
    this._post({ t: 'PROBE' });
    this._legacyTimer = setTimeout(() => {
      if (this._role === null && !this._legacySawPeer) this._becomeLeader();
    }, LEGACY_PROBE_MS);
  }

  /** best-effort promotion: probe once more, and claim if nobody answers */
  private _legacyPromote(delayMs: number): void {
    clearTimeout(this._legacyTimer);
    this._legacyTimer = setTimeout(() => {
      this._legacySawPeer = false;
      this._post({ t: 'PROBE' });
      this._legacyTimer = setTimeout(() => {
        if (!this._legacySawPeer && this._role !== 'leader') this._becomeLeader();
      }, LEGACY_PROBE_MS);
    }, delayMs);
  }


  // transitions

  private _becomeLeader(): void {
    clearTimeout(this._transferTimer);
    this._transferTimer = undefined;
    this._stopPeerPoll();
    this._role = 'leader';
    this._peer = null;
    // retire any pre-Web-Locks build still open on this profile: it shares this channel but not the
    // schema (the two protocols are mutually invisible), so without this two builds would both run on
    // one IndexedDB for the deploy window. Its protocol reads TRANSFER_HERE as 'everyone stands down'.
    this._channel?.postMessage({ type: 'TRANSFER_HERE', clientId: 'web-locks-build', timestamp: Date.now() });
    if (!this._useLocks) {
      window.addEventListener('pagehide', this._onLegacyPageHide);
      // unsolicited HERE: a follower still mid-promotion sees it and aborts its own claim, which
      // closes most of the concurrent-promotion race (the fallback has no atomic arbiter)
      this._post({ t: 'HERE' });
    }
    this._notify();
  }

  private _becomeFollower(): void {
    if (this._role === 'leader') return this._demoteAndWipe();
    this._role = 'follower';
    this._peer = null;
    if (this._useLocks) this._lockEnqueue(); // auto-promotion when the holder goes away
    this._startPeerPoll();
    this._notify();
  }

  /**
   * Losing the instance while running: the context is wiped by destroying the JS realm (navigation or
   * reload), because unmounting the app frees nothing that matters. See DEMOTE_INTO for the landing.
   */
  private _demoteAndWipe(): void {
    this._role = 'follower';
    this._wiping = true; // hides Transfer Here and blocks requestTransfer until the realm dies
    this._peer = null;
    clearTimeout(this._transferTimer);
    this._transferTimer = undefined;
    if (!this._useLocks) window.removeEventListener('pagehide', this._onLegacyPageHide);
    // show the takeover screen now: this unmounts the app, which also removes its beforeunload guard
    // (and without recent user activation in this tab, browsers suppress the prompt anyway)
    this._notify();
    // flush what may still be in memory (forced steal: our only chance; cooperative: idempotent
    // re-run after _handOver already flushed), then die - time-capped so a wedged flush cannot
    // leave a full-heap zombie behind
    Promise.race([
      this.#flush(),
      new Promise((resolve) => setTimeout(resolve, 8_000)),
    ]).then(() => setTimeout(this._wipe, DEMOTE_WIPE_DELAY_MS));
  }

  private _wipe = (): void => {
    if (this._role === 'leader') { // belt: transfer-into-wiping is blocked, but never wipe a live leader
      this._wiping = false;
      this._notify();
      return;
    }
    // NEVER document.write here: writing after starting a navigation cancels the navigation
    // (document.open() aborts it), and the realm survives - empirically verified on Firefox
    if (DEMOTE_INTO === 'closed-page')
      window.location.href = '/closed.html'; // static, zero-JS courtesy page: realm death with a message
    else
      window.location.reload();
    // belt: if the navigation did not commit for any reason, the realm must still die
    setTimeout(() => window.location.reload(), 2_000);
  };


  // channel

  private _post(message: ChannelMessage): void {
    this._channel?.postMessage(message);
  }

  private _onMessage = (message: ChannelMessage): void => {
    switch (message.t) {

      case 'PING':
        // only the leader answers, with a FRESH snapshot (never a value sampled at join time)
        if (this._role === 'leader')
          this._post({ t: 'STATE', work: localActiveWorkGet(), build: Release.buildInfo('frontend').timestamp });
        break;

      case 'STATE':
        if (this._role !== 'follower') break;
        this._lastPeerReplyAt = Date.now();
        this._peer = { work: message.work, buildTimestamp: message.build ?? null, responsive: true };
        this._notify();
        break;

      case 'YIELD':
        if (this._role === 'leader') void this._handOver();
        break;

      case 'READY':
        // only the window that asked acts on this (its grace timer is still pending)
        if (this._role === 'follower' && this._transferTimer !== undefined) this._takeOver();
        break;

      case 'PROBE':
        if (!this._useLocks && this._role === 'leader') this._post({ t: 'HERE' });
        break;

      case 'HERE':
        if (this._useLocks) break;
        this._legacySawPeer = true;
        if (this._role === 'leader') {
          // two live instances on one database: the fallback's one real failure state - report, don't
          // self-demote (both leaders would demote and flap; a tie-break protocol isn't worth it here)
          console.error('[single-tab] dual-instance detected (best-effort fallback, non-secure context)');
          posthogCaptureEvent('app_singletab_dual_instance');
          break;
        }
        if (this._role === null) {
          clearTimeout(this._legacyTimer);
          this._becomeFollower();
        }
        break;

      case 'BYE':
        // the leader stepped down: if we asked for it, claim right away, else back off a little
        if (!this._useLocks && this._role === 'follower')
          this._legacyPromote(this._transferTimer !== undefined ? 0 : 50 + Math.floor(Math.random() * 200));
        break;
    }
  };

  private _onLegacyPageHide = (): void => {
    // fallback only: with Web Locks the browser releases on its own, no unload handler needed
    this._post({ t: 'BYE' });
  };


  // peer polling (follower only, and only while visible)

  private _startPeerPoll(): void {
    this._stopPeerPoll();
    this._lastPeerReplyAt = Date.now();
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    this._pollTimer = setInterval(this._pingPeer, PEER_POLL_MS);
    this._pingPeer();
  }

  private _stopPeerPoll(): void {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = undefined;
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
  }

  private _pingPeer = (): void => {
    if (this._role !== 'follower') return;
    if (document.visibilityState === 'hidden') return; // no background traffic
    this._post({ t: 'PING' });

    // no answer for a while: the other window is frozen or gone
    if (Date.now() - this._lastPeerReplyAt > PEER_UNRESPONSIVE_MS && this._peer?.responsive !== false) {
      this._peer = { work: this._peer?.work ?? null, buildTimestamp: this._peer?.buildTimestamp ?? null, responsive: false };
      this._notify();
      // the fallback has no arbiter to promote us, so assume the holder is gone; jittered, or every
      // follower would claim inside the same probe window before the winner's HERE can reach them
      if (!this._useLocks) this._legacyPromote(Math.floor(Math.random() * 600));
    }
  };

  private _onVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible') return;
    this._lastPeerReplyAt = Date.now(); // don't count time spent hidden as unresponsiveness
    this._pingPeer();
  };


  // notification

  private _buildSnapshot(): InstanceState {
    return { role: this._role, peer: this._peer, wiping: this._wiping };
  }

  private _notify(): void {
    this._snapshot = this._buildSnapshot();
    this._subs.forEach((callback) => callback(this._snapshot));
  }

}


// singleton, created lazily on the gate provider's first render: this module is in the shared _app
// bundle, so a claim at import time would make even the pages that opt out of enforcement
// (PAGES_CONF noSingleTab: print, verify-email, oauth callback) hold the lock and block the real app

declare global {
  var __bigAgiInstanceLock: InstanceLockManager | undefined; // survives HMR: never claim the lock twice from the same page
}

function _manager(): InstanceLockManager | null {
  if (typeof window === 'undefined') return null; // SSR
  // first called from a useState initializer (render time): safe only because the singleton makes it
  // idempotent under StrictMode/concurrent double-invocation - this guard is load-bearing
  if (!globalThis.__bigAgiInstanceLock)
    globalThis.__bigAgiInstanceLock = new InstanceLockManager();
  return globalThis.__bigAgiInstanceLock;
}


// Register a pre-hand-over flusher; returns the unregister, so the pair` is useEffect-shaped. Here in case we need to caiit in the future outside of the components tree.
function _instanceLockAddFlusher(flusher: () => Promise<void>): () => void {
  return globalThis.__bigAgiInstanceLock?.addFlusher(flusher) ?? (() => undefined);
}

/** Register a pre-hand-over stableFlushFn for the lifetime of the component. Pass a stable reference. */
export function useInstanceLockFlusher(stableFlushFn: () => Promise<void>): void {
  React.useEffect(() => {
    return _instanceLockAddFlusher(stableFlushFn);
  }, [stableFlushFn]);
}

export function instanceLockRequestTransfer(): void {
  _manager()?.requestTransfer();
}


const FALLBACK_STATE: InstanceState = { role: null, peer: null, wiping: false }; // SSR

/**
 * Single-instance state. `role` is null only for the brief undecided window (sub-ms with Web Locks,
 * one probe round-trip on the fallback); rendering nothing until it resolves keeps followers from
 * booting the storage/sync stack just to tear it down.
 */
export function useInstanceLock(): InstanceState {
  const [state, setState] = React.useState<InstanceState>(() => _manager()?.getState() ?? FALLBACK_STATE);
  React.useEffect(() => _manager()?.subscribe(setState), []);
  return state;
}
