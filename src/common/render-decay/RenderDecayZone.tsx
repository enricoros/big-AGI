import * as React from 'react';

import { useLabsAdaptiveRendering } from '~/common/stores/store-ux-labs';


/**
 * Render decay: a zone (a chat pane, the Beam rays grid, the merges grid) watches how much main-thread time its in-flux
 * (streaming) blocks spend parsing; past a budget the zone decays and those blocks render lighter (RenderMarkdownLite
 * instead of react-markdown) for as long as any of them streams. When the last one stops, the zone forgets: a heavy
 * message does not lighten the next one, and many merges decay and recover together.
 *
 * With the setting 'off' the zone provides nothing and every block takes its usual path. 'debug' measures like 'auto',
 * highlights the lite blocks and logs the zone's life to the console.
 */

// configuration
const RENDER_DECAY_ENABLED = true; // kill switch
const DECAY_LEAK_PER_MS = 0.25; // parse time the zone sustains: 250 ms per second, a quarter of the main thread
const DECAY_BURST_MS = 250; // decays once the parse time accumulated above that rate passes this

let _debugZoneCounter = 0;


interface RenderDecayZoneState {
  readonly measuring: boolean;
  readonly debug: boolean;
  readonly isDecayed: () => boolean;
  readonly subscribe: (onChange: () => void) => () => void;
  readonly enter: () => () => void; // a live stream registers; the returned function leaves
  readonly report: (parseMs: number) => void;
}

function _createRenderDecayZone(alwaysDecayed: boolean, debug: boolean): RenderDecayZoneState {
  let decayed = alwaysDecayed;
  let streams = 0;
  let level = 0;
  let levelAt = 0;
  const listeners = new Set<() => void>();

  const debugId = debug ? `zone#${++_debugZoneCounter}` : '';
  if (debug) console.log(`[DEV] RenderDecay ${debugId}: created`);

  const setDecayed = (value: boolean) => {
    if (alwaysDecayed || value === decayed) return;
    decayed = value;
    if (debug) console.log(`[DEV] RenderDecay ${debugId}: decay ${value ? 'ON' : 'OFF'}, level ${Math.round(level)} ms, ${streams} streams, ${listeners.size} subscribers`);
    listeners.forEach(listener => listener());
  };

  return {
    measuring: !alwaysDecayed,
    debug,
    // both methods are for useSyncExternalStore
    isDecayed: () => decayed, // getSnapshot
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    // for instance counting at mount/unmount
    enter: () => {
      streams++;
      if (debug) console.log(`[DEV] RenderDecay ${debugId}: stream enter -> ${streams}`);
      return () => {
        --streams;
        if (debug) console.log(`[DEV] RenderDecay ${debugId}: stream leave -> ${streams}`);
        if (streams > 0) return;
        // the last live stream left: the zone forgets
        level = 0;
        setDecayed(false);
      };
    },
    // auto-activation of decay
    report: (parseMs) => {
      if (decayed) return;
      const now = performance.now();
      level = Math.max(0, level - (now - levelAt) * DECAY_LEAK_PER_MS) + parseMs;
      levelAt = now;
      if (level > DECAY_BURST_MS)
        setDecayed(true);
    },
  };
}

const RenderDecayContext = React.createContext<RenderDecayZoneState | null>(null);


export function RenderDecayZone(props: { children: React.ReactNode }) {

  // external state
  const mode = useLabsAdaptiveRendering();

  // one zone per mode: decay flips reach only the subscribed in-flux blocks, and never re-render this subtree
  const zoneState = React.useMemo(() => {
    if (!RENDER_DECAY_ENABLED || mode === 'off') return null;
    return _createRenderDecayZone(mode === 'on', mode === 'debug');
  }, [mode]);

  return (
    <RenderDecayContext.Provider value={zoneState}>
      {props.children}
    </RenderDecayContext.Provider>
  );
}


const _noSubscribe = () => () => undefined;
const _notDecayed = () => false;

/**
 * Used by AutoBlocksRenderer - report costs, activate light rendering.
 *
 * For the owner of a block that may be in flux: while `inFlux`, registers a live stream with the enclosing zone and
 * returns whether decay is active - render lighter, 'debug' to also highlight it - and where to report parse costs
 * (undefined when not measuring).
 */
export function useRenderDecay(inFlux: boolean): { active: boolean | 'debug', onParseCost?: (parseMs: number) => void } {
  const zoneState = React.useContext(RenderDecayContext);
  const live = inFlux ? zoneState : null;

  const decayed = React.useSyncExternalStore(live?.subscribe ?? _noSubscribe, live?.isDecayed ?? _notDecayed, _notDecayed);

  // [effect] accounting of clients; once they all leave (unmount) the zone resets
  React.useEffect(() => live?.enter(), [live]);

  return {
    active: (decayed && live?.debug) ? 'debug' : decayed,
    onParseCost: (live?.measuring && !decayed) ? live.report : undefined,
  };
}
