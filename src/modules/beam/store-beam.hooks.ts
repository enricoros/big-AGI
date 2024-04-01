import * as React from 'react';
import { type StoreApi, useStore } from 'zustand';

import type { BeamStore } from './store-beam-vanilla';


export type BeamStoreApi = Readonly<StoreApi<BeamStore>>;


export const useBeamStore = <T, >(beamStore: BeamStoreApi, selector: (store: BeamStore) => T): T =>
  useStore(beamStore, selector);

/*export const useIsBeamOpen = (beamStore?: BeamStoreApi) => {
  const [open, setOpen] = React.useState(false);

  // attach to the current beamStore
  React.useEffect(() => {
    if (!beamStore) {
      setOpen(false);
      return;
    }
    setOpen(beamStore.getState().isOpen);
    return beamStore.subscribe((state: BeamState, prevState: BeamState) => {
      (state.isOpen !== prevState.isOpen) && setOpen(state.isOpen);
    });
  }, [beamStore]);

  return open;
};*/

export const useAreBeamsOpen = (beamStores: (BeamStoreApi | null)[]): boolean[] => {
  const [opens, setOpens] = React.useState<boolean[]>([]);

  React.useEffect(() => {
    // Reflect the current state
    setOpens(beamStores.map((beamStore) => !!beamStore?.getState().isOpen));

    // Attach to the current beamStores
    const unsubscribes = beamStores.map((beamStore, index) => {
      if (!beamStore) {
        return () => {
        }; // Explicitly return a no-op function for clarity
      }
      return beamStore.subscribe((state: BeamStore, prevState: BeamStore) => {
        if (state.isOpen !== prevState.isOpen) {
          setOpens((opens) => {
            const nextOpens = [...opens];
            nextOpens[index] = state.isOpen;
            return nextOpens;
          });
        }
      });
    });

    // Cleanup: unsubscribe from all subscriptions when the component unmounts or beamStores changes
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [beamStores]);

  return opens;
};