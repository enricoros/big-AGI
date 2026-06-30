/**
 * Live SVG Animator - feature-local, pure in-memory global store.
 *
 * Single live loop at a time, so a global create() store (no persistence) is the simplest idiomatic
 * shape (template: memstore-aix-client-debugger.ts). The loop (livesvg.loop.ts) reads/writes this
 * store imperatively via liveSvgActions(); the UI subscribes via useLiveSvgStore().
 */

import { create } from 'zustand';

import type { DLLMId } from '~/common/stores/llms/llms.types';

import { LIVESVG_FRAME_DELAY_MS, LIVESVG_FRAMES_PER_CALL_DEFAULT, LIVESVG_FRAMES_PER_CALL_MAX, LIVESVG_LOG_MAX, LIVESVG_MAX_PAIRS, LIVESVG_RECENT_STEERS, LIVESVG_TPS_HISTORY, type Frame, type GenStat, type HistoryItem, type LiveSvgLogEntry, type LiveSvgLogKind, type LiveSvgStatus, type Steer } from './livesvg.types';


// state (data only)
interface LiveSvgState {
  modeActive: boolean;             // AppChat mounts the takeover when true
  status: LiveSvgStatus;
  prompt: string;                  // the single user prompt that seeds the animation
  plan: string;                    // optional short plan derived from the prompt
  history: HistoryItem[];          // incrementally-managed request transcript (user text + frames + 1 removal marker)
  removedFrames: number;           // running count of frames collapsed into the <system-information> marker
  timeline: Frame[];               // last <= LIVESVG_MAX_PAIRS frames, for the UI thumbnails/large view
  mailbox: Steer[];                // pending spoken steers, drained at frame boundaries
  recentSteers: string[];          // capped ticker of recent steers (UI feedback)
  currentFrameIndex: number;       // monotonic frame counter
  fps: number;                     // smoothed frames-per-second
  selectedLlmId: DLLMId | null;    // user-selected model (defaults to Cerebras Gemma); persists across enter/exit
  frameDelayMs: number;            // user-editable pause between generations (default LIVESVG_FRAME_DELAY_MS); persists across enter/exit
  framesPerCall: number;           // user-editable SVG frames requested per inference call (1..MAX); persists across enter/exit
  error: string | null;
  // generation statistics (reset on start)
  totalGenerations: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalGenMs: number;              // summed generation time (for accurate avg TPS)
  tpsHistory: number[];            // per-generation tokens/sec, bounded for the chart
  log: LiveSvgLogEntry[];          // bounded event/error log
  _logSeq: number;                 // monotonic log id counter
}

// actions (functions only)
interface LiveSvgActions {
  enterMode: (llmId?: DLLMId | null) => void;
  exitMode: () => void;
  reset: () => void;
  setPrompt: (prompt: string) => void;
  start: (prompt: string) => void;
  stop: () => void;
  pushSteer: (text: string) => void;
  takeSteers: (now: number) => Steer[];
  appendUserText: (text: string) => void;
  appendFrame: (frame: Frame) => void;
  recordGenStat: (stat: GenStat) => void;
  pushLog: (kind: LiveSvgLogKind, text: string) => void;
  setSelectedLlmId: (llmId: DLLMId | null) => void;
  setFrameDelayMs: (frameDelayMs: number) => void;
  setFramesPerCall: (framesPerCall: number) => void;
  // internal setters used by the loop
  _setStatus: (status: LiveSvgStatus) => void;
  _setPlan: (plan: string) => void;
  _setFps: (fps: number) => void;
  _setError: (error: string | null) => void;
}

type LiveSvgStore = LiveSvgState & LiveSvgActions;


const initialLoopState = (): Pick<LiveSvgState, 'status' | 'plan' | 'history' | 'removedFrames' | 'timeline' | 'mailbox' | 'recentSteers' | 'currentFrameIndex' | 'fps' | 'error' | 'totalGenerations' | 'totalTokensIn' | 'totalTokensOut' | 'totalGenMs' | 'tpsHistory' | 'log' | '_logSeq'> => ({
  status: 'idle',
  plan: '',
  history: [],
  removedFrames: 0,
  timeline: [],
  mailbox: [],
  recentSteers: [],
  currentFrameIndex: 0,
  fps: 0,
  error: null,
  totalGenerations: 0,
  totalTokensIn: 0,
  totalTokensOut: 0,
  totalGenMs: 0,
  tpsHistory: [],
  log: [],
  _logSeq: 0,
});


export const useLiveSvgStore = create<LiveSvgStore>((_set, _get) => ({

  // initial state
  modeActive: false,
  prompt: '',
  selectedLlmId: null,
  frameDelayMs: LIVESVG_FRAME_DELAY_MS,
  framesPerCall: LIVESVG_FRAMES_PER_CALL_DEFAULT,
  ...initialLoopState(),

  // actions

  // enter the takeover; adopt the caller's model (the chat's selected Cerebras model) as 'the' model
  enterMode: (llmId) => _set(llmId ? { modeActive: true, selectedLlmId: llmId } : { modeActive: true }),

  // keep selectedLlmId across enter/exit so the model choice sticks
  exitMode: () => _set({ modeActive: false, prompt: '', ...initialLoopState() }),

  // clear the loop but keep the mode open (back to the empty prompt state); keeps the prompt for editing
  reset: () => _set({ ...initialLoopState() }),

  setPrompt: (prompt) => _set({ prompt }),

  start: (prompt) => _set({
    prompt,
    ...initialLoopState(),
    status: 'running',
    plan: prompt.trim(),
  }),

  stop: () => _set((state) => state.status === 'running' ? { status: 'stopping' } : {}),

  pushSteer: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    _set((state) => ({
      mailbox: [...state.mailbox, { text: trimmed, tEnd: Date.now() }],
      recentSteers: [...state.recentSteers, trimmed].slice(-LIVESVG_RECENT_STEERS),
    }));
  },

  takeSteers: (now) => {
    const { mailbox } = _get();
    if (!mailbox.length) return [];
    const ready = mailbox.filter((s) => s.tEnd <= now);
    if (!ready.length) return [];
    const remaining = mailbox.filter((s) => s.tEnd > now);
    _set({ mailbox: remaining });
    return ready;
  },

  // append user text (a steer) at the END of the history; preserved forever (never removed)
  appendUserText: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    _set((state) => ({ history: [...state.history, { kind: 'user', text: trimmed }] }));
  },

  // append a generated frame at the END of the history (the tape), then collapse old frames in place;
  // also keep the UI timeline bounded to the last LIVESVG_MAX_PAIRS frames
  appendFrame: (frame) => _set((state) => {

    // 1. UI timeline: bounded buffer of recent frames
    const timeline = [...state.timeline, frame].slice(-LIVESVG_MAX_PAIRS);

    // 2. history: append the frame (svg + png) at the end of the tape
    let history: HistoryItem[] = [...state.history, { kind: 'frame', ...frame }];

    // 3. step-by-step trim: replace the OLDEST frames (beyond retention) IN PLACE with a 1-count
    //    removal marker, so the marker stays where the frame was (interleaved with preserved steers)
    let removedFrames = state.removedFrames;
    while (history.filter((h) => h.kind === 'frame').length > LIVESVG_MAX_PAIRS) {
      const oldestFrameIdx = history.findIndex((h) => h.kind === 'frame');
      if (oldestFrameIdx < 0) break;
      history[oldestFrameIdx] = { kind: 'system', removed: 1 };
      removedFrames++;
    }

    // 4. coalesce consecutive removal markers (runs of removed frames merge; steers between them keep markers separate)
    if (removedFrames > state.removedFrames) {
      const coalesced: HistoryItem[] = [];
      for (const item of history) {
        const last = coalesced[coalesced.length - 1];
        if (item.kind === 'system' && last?.kind === 'system')
          coalesced[coalesced.length - 1] = { kind: 'system', removed: last.removed + item.removed };
        else
          coalesced.push(item);
      }
      history = coalesced;
    }

    return { timeline, history, removedFrames, currentFrameIndex: frame.index + 1 };
  }),

  recordGenStat: (stat) => _set((state) => ({
    totalGenerations: state.totalGenerations + 1,
    totalTokensIn: state.totalTokensIn + (stat.tokensIn || 0),
    totalTokensOut: state.totalTokensOut + (stat.tokensOut || 0),
    totalGenMs: state.totalGenMs + (stat.ms || 0),
    tpsHistory: [...state.tpsHistory, stat.tps].slice(-LIVESVG_TPS_HISTORY),
  })),

  pushLog: (kind, text) => _set((state) => ({
    _logSeq: state._logSeq + 1,
    log: [...state.log, { id: state._logSeq, kind, text }].slice(-LIVESVG_LOG_MAX),
  })),

  setSelectedLlmId: (selectedLlmId) => _set({ selectedLlmId }),

  setFrameDelayMs: (frameDelayMs) => _set({ frameDelayMs: Math.max(0, Math.round(frameDelayMs)) }),

  setFramesPerCall: (framesPerCall) => _set({ framesPerCall: Math.min(LIVESVG_FRAMES_PER_CALL_MAX, Math.max(1, Math.round(framesPerCall))) }),

  // internal setters
  _setStatus: (status) => _set({ status }),
  _setPlan: (plan) => _set({ plan }),
  _setFps: (fps) => _set({ fps }),
  _setError: (error) => _set({ error }),

}));


/** Imperative (non-React) access for the loop controller. */
export const liveSvgActions = (): LiveSvgStore => useLiveSvgStore.getState();
