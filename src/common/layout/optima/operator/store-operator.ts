import { create } from 'zustand';
import { persist } from 'zustand/middleware';


/**
 * Operator FAB - one floating, draggable "Big-AGI" control on mobile.
 *
 * Centralizes the quick actions that are otherwise buried in menus (home, new chat, incognito,
 * new document) and the voice entry point to the Operator (spoken commands routed to UI actions).
 * Future: absorbs the Ramble and Devices floating buttons as *status rings* on the same FAB.
 */

export type OperatorFabSide = 'left' | 'right';

/** Live, non-persisted status shown as a ring around the FAB */
export type OperatorFabStatus = 'idle' | 'listening' | 'rambling' | 'devices';

/** How the Operator remembers: 'ephemeral' = no memory at all, 'thread' = one dedicated, aggressively-compressed chat */
export type OperatorMemoryMode = 'ephemeral' | 'thread';


interface OperatorStore {

  // persisted
  fabEnabled: boolean;
  fabSide: OperatorFabSide;
  fabBottom: number;          // px from the bottom of the viewport (center of the FAB)
  memoryMode: OperatorMemoryMode;

  // transient
  fabStatus: OperatorFabStatus;

  setFabEnabled: (enabled: boolean) => void;
  setFabPosition: (side: OperatorFabSide, bottom: number) => void;
  setMemoryMode: (mode: OperatorMemoryMode) => void;
  setFabStatus: (status: OperatorFabStatus) => void;

}

export const useOperatorStore = create<OperatorStore>()(persist(
  (set) => ({

    fabEnabled: true,
    fabSide: 'right',
    fabBottom: 220,
    memoryMode: 'ephemeral',

    fabStatus: 'idle',

    setFabEnabled: (fabEnabled) => set({ fabEnabled }),
    setFabPosition: (fabSide, fabBottom) => set({ fabSide, fabBottom }),
    setMemoryMode: (memoryMode) => set({ memoryMode }),
    setFabStatus: (fabStatus) => set({ fabStatus }),

  }),
  {
    name: 'app-operator',
    partialize: ({ fabEnabled, fabSide, fabBottom, memoryMode }) => ({ fabEnabled, fabSide, fabBottom, memoryMode }),
  },
));

export function operatorSetFabStatus(status: OperatorFabStatus) {
  useOperatorStore.getState().setFabStatus(status);
}


// [DEV] expose for poking the status ring from devtools: __operatorStore.getState().setFabStatus('rambling')
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined')
  (window as any).__operatorStore = useOperatorStore;
