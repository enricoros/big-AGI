import { create } from 'zustand';

import type { AixAPI_Context_ChatGenerate } from '../../server/api/aix.wiretypes';

//
// NOTE: this file is supposed to be lightweight and to be kept in memory. Particles are used by reference and
// not cloned or modified. Visualization is a Reactive stringification of the referred objects pretty much.
//

const DEFAULT_FRAMES_COUNT = 10;

// Context names that should NOT auto-select when created (background operations)
const BACKGROUND_CONTEXT_NAMES = [
  'chat-ai-summarize',
  'chat-ai-summary',
  'chat-ai-title',
  'chat-attachment-prompts',
  'chat-followup-chartjs',
  'chat-followup-diagram',
  'chat-followup-htmlui',
  'fixup-code',
  'aifn-image-caption',
] as const satisfies (AixAPI_Context_ChatGenerate['name'] | string)[];


/// Types ///

export namespace AixClientDebugger {

  export interface Frame {
    // frame information
    id: AixFrameId;
    timestamp: number;
    transport: Transport;
    // calling purpose
    context: Context;
    // upstream request
    url: string;
    headers: string;
    body: string;
    bodySize: number;
    isComplete: boolean;
    // upstream profiler measurements
    profilerMeasurements?: Measurements;
    // NOTE: in the future we could debug the raw SSE streams.. not now
    // aix response particles
    particles: Particle[];
  }

  export type Transport = 'csf' | 'trpc';

  export type Measurements = Record<string, string | number>[];

  export interface Particle {
    timestamp: number;
    content: Record<string, any>;
    isAborted?: boolean;
  }

  export interface Context {
    contextName: string;
    contextRef: string;
  }

}

export type AixFrameId = number;

let _lastInMemoryFrameId = 1;

function _createAixClientDebuggerFrame(transport: AixClientDebugger.Transport, frameContext: AixClientDebugger.Context): AixClientDebugger.Frame {
  return {
    id: ++_lastInMemoryFrameId,
    timestamp: Date.now(),
    transport: transport,
    url: '',
    headers: '',
    body: '',
    bodySize: 0,
    particles: [],
    isComplete: false,
    context: {
      contextName: frameContext.contextName || '_contextName',
      contextRef: frameContext.contextRef || '_contextRef',
    },
  };
}


/// Store ///

export type AixDebuggerOpenKey = 'headers' | 'body' | 'particles';

interface AixClientDebuggerState {
  frames: AixClientDebugger.Frame[];
  activeFrameId: AixFrameId | null;
  maxFrames: number;
  // per-section open state for the current frame view
  openStates: Partial<Record<AixDebuggerOpenKey, true>>;
  // AIX force disable streaming for all requests (separate from per-model llmForceNoStream)
  aixNoStreaming: boolean;
  // AIX next payload override - JSON string injected into requests after validation
  requestBodyOverrideJson: string;
}

interface AixClientDebuggerActions {
  // frames
  createFrame: (transport: AixClientDebugger.Transport, initialContext: AixClientDebugger.Context) => AixFrameId;
  setRequest: (fId: AixFrameId, updates: Pick<AixClientDebugger.Frame, 'url' | 'headers' | 'body' | 'bodySize'>) => void;
  setProfilerMeasurements: (fId: AixFrameId, measurements: AixClientDebugger.Measurements) => void;
  addParticle: (fId: AixFrameId, particle: AixClientDebugger.Particle, isAborted?: boolean) => void;
  completeFrame: (fId: AixFrameId) => void;

  // client view
  setActiveFrame: (activeFrameId: AixFrameId | null) => void;
  setMaxFrames: (count: number) => void;
  clearHistory: () => void;
  toggleOpenState: (key: AixDebuggerOpenKey) => void;
}

type AixClientDebuggerStore = AixClientDebuggerState & AixClientDebuggerActions;


export const useAixClientDebuggerStore = create<AixClientDebuggerStore>((_set) => ({

  // initial state
  frames: [],
  activeFrameId: null,
  maxFrames: DEFAULT_FRAMES_COUNT,
  openStates: { headers: true, body: true }, // headers + body open by default; particles closed (heavy)
  aixNoStreaming: false,
  requestBodyOverrideJson: '',


  // Frame actions

  createFrame: (transport, initialContext) => {
    const newFrame = _createAixClientDebuggerFrame(transport, initialContext);

    // Don't auto-select background operations (e.g., title generation) to avoid
    // stealing focus from the main conversation request
    const isBackgroundOperation = (BACKGROUND_CONTEXT_NAMES as readonly string[]).includes(initialContext.contextName);

    _set(({ activeFrameId, frames, maxFrames }) => {
      // Sticky selection: only snap to the new frame if the user was following latest (nothing selected, or the current selection is the previous top frame).
      const previousLatestId = frames[0]?.id ?? null;
      const isFollowingLatest = activeFrameId === null || activeFrameId === previousLatestId;
      const shouldAutoSelect = isFollowingLatest && !isBackgroundOperation;
      return {
        frames: [newFrame, ...(frames)].slice(0, maxFrames),
        activeFrameId: shouldAutoSelect ? newFrame.id : activeFrameId,
      };
    });

    return newFrame.id;
  },

  setRequest: (fId, requestData) =>
    _set(state => ({
      frames: state.frames.map(frame => frame.id !== fId ? frame : {
        ...frame,
        ...requestData,
      }),
    })),

  setProfilerMeasurements: (fId, measurements) =>
    _set(state => ({
      frames: state.frames.map(frame => frame.id !== fId ? frame : {
        ...frame,
        profilerMeasurements: measurements,
      }),
    })),

  addParticle: (fId, particle, isAborted = false) =>
    _set(state => ({
      frames: state.frames.map(frame => frame.id !== fId ? frame : {
        ...frame,
        particles: [...frame.particles, particle],
      }),
    })),

  completeFrame: (fId) =>
    _set(state => ({
      frames: state.frames.map(frame => frame.id !== fId ? frame : {
        ...frame,
        isComplete: true,
      }),
    })),


  // Client View actions

  setActiveFrame: (activeFrameId) => _set({
    activeFrameId,
  }),

  setMaxFrames: (count) => _set(state => ({
    maxFrames: count,
    frames: state.frames.slice(0, count),
  })),

  clearHistory: () => _set({
    frames: [],
    activeFrameId: null,
  }),

  toggleOpenState: (key) => _set(state => {
    const next = { ...state.openStates };
    if (next[key]) delete next[key];
    else next[key] = true;
    return { openStates: next };
  }),

}));


export function aixClientDebuggerActions(): AixClientDebuggerActions {
  return useAixClientDebuggerStore.getState();
}

export function aixClientDebuggerSetRBO(json: string) {
  useAixClientDebuggerStore.setState({ requestBodyOverrideJson: json });
}

export function aixClientDebuggerGetRBO(): string {
  return useAixClientDebuggerStore.getState().requestBodyOverrideJson;
}

export function getAixDebuggerNoStreaming(): boolean {
  return useAixClientDebuggerStore.getState().aixNoStreaming;
}

export function toggleAixDebuggerNoStreaming(): void {
  useAixClientDebuggerStore.setState(state => ({ aixNoStreaming: !state.aixNoStreaming }));
}
