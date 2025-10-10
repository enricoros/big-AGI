import { create } from 'zustand';

//
// NOTE: this file is supposed to be lightweight and to be kept in memory. Particles are used by reference and
// not cloned or modified. Visualization is a Reactive stringification of the referred objects pretty much.
//

const DEFAULT_FRAMES_COUNT = 10;


/// Types ///

export namespace AixClientDebugger {

  export interface Frame {
    // frame information
    id: AixFrameId;
    timestamp: number;
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

function _createAixClientDebuggerFrame(frameContext: AixClientDebugger.Context): AixClientDebugger.Frame {
  return {
    id: ++_lastInMemoryFrameId,
    timestamp: Date.now(),
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

interface AixClientDebuggerState {
  frames: AixClientDebugger.Frame[];
  activeFrameId: AixFrameId | null;
  maxFrames: number;
}

interface AixClientDebuggerActions {
  // frames
  createFrame: (initialContext: AixClientDebugger.Context) => AixFrameId;
  setRequest: (fId: AixFrameId, updates: Pick<AixClientDebugger.Frame, 'url' | 'headers' | 'body' | 'bodySize'>) => void;
  setProfilerMeasurements: (fId: AixFrameId, measurements: AixClientDebugger.Measurements) => void;
  addParticle: (fId: AixFrameId, particle: AixClientDebugger.Particle, isAborted?: boolean) => void;
  completeFrame: (fId: AixFrameId) => void;

  // client view
  setActiveFrame: (activeFrameId: AixFrameId | null) => void;
  setMaxFrames: (count: number) => void;
  clearHistory: () => void;
}

type AixClientDebuggerStore = AixClientDebuggerState & AixClientDebuggerActions;


export const useAixClientDebuggerStore = create<AixClientDebuggerStore>((_set) => ({

  // initial state
  frames: [],
  activeFrameId: null,
  maxFrames: DEFAULT_FRAMES_COUNT,


  // Frame actions

  createFrame: (initialContext) => {
    const newFrame = _createAixClientDebuggerFrame(initialContext);

    _set((state) => ({
      frames: [newFrame, ...state.frames].slice(0, state.maxFrames),
      activeFrameId: newFrame.id,
    }));

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

}));


export function aixClientDebuggerActions() {
  return useAixClientDebuggerStore.getState() as AixClientDebuggerActions;
}
