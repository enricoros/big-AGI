import type { StoreApi } from 'zustand';

import type { DMessage } from '~/common/stores/chat/chat.message';

import { BRay, rayIsMessageErrorOnly, rayIsScattering, rayIsSelectable } from '../scatter/beam.scatter';


/**
 * Merge inputs: what a Fusion reads from the Rays, and the wait for them.
 *
 * Starting a merge records the intent to run. While rays are still generating, the fusion holds an
 * `inputsWait` instead of running: the card stays as it was (editable, previous output kept), and
 * everything - instructions, model, history, replies - is read when the merge really starts.
 *
 * The wait settles once, and the first cause wins:
 *  - 'ready':     no ray is generating anymore - completed, failed, stopped on its card or removed
 *  - 'merge-now': the user does not wait - merges the replies that are ready, the others keep generating
 *  - 'cancelled': Stop on the merge, its removal or replacement, Stop on all Beams, Beam closing
 *
 * The wait lives in the Beam store, not in a component: unmounting the view does not cancel it, and a
 * headless run gets the same sequencing. Rays restarted or added during the wait extend it. Rays restarted
 * after the merge started do not affect it, as the replies are read once, at start.
 */


/// Inputs ///

export function gatherInputsFromRays(rays: BRay[]): { messages: DMessage[], pendingCount: number } {
  return {
    // the replies to merge: settled, with content, not just an error
    messages: rays.filter(ray => !rayIsScattering(ray) && rayIsSelectable(ray) && !rayIsMessageErrorOnly(ray)).map(ray => ray.message),
    // the replies still generating
    pendingCount: rays.filter(rayIsScattering).length,
  };
}


/// Wait ///

type GatherInputsWaitOutcome = 'ready' | 'merge-now' | 'cancelled';

export interface GatherInputsWait {
  readonly outcome: Promise<GatherInputsWaitOutcome>; // always settles, never rejects
  readonly mergeNow: () => void;
  readonly cancel: () => void;
}

export function gatherInputsWait(beamStore: Pick<StoreApi<{ rays: BRay[] }>, 'subscribe'>): GatherInputsWait {

  let resolveOutcome: (o: GatherInputsWaitOutcome) => void = () => { /* replaced synchronously below */ };
  const outcome = new Promise<GatherInputsWaitOutcome>(resolve => resolveOutcome = resolve);

  // the first to settle wins, the rest are no-ops
  const settle = (o: GatherInputsWaitOutcome) => {
    unsubscribe();
    resolveOutcome(o);
  };

  // runs on every streamed token: bails at the first ray still generating
  const unsubscribe = beamStore.subscribe(({ rays }) => {
    if (!rays.some(rayIsScattering))
      settle('ready');
  });

  return {
    outcome,
    mergeNow: () => settle('merge-now'),
    cancel: () => settle('cancelled'),
  };
}
