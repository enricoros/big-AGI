import * as React from 'react';
import { type StoreApi, useStore } from 'zustand';

import { useShallowStable } from '~/common/util/hooks/useShallowObject';

import type { BeamStore } from './store-beam_vanilla';


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

export function useAreBeamsOpen(beamStores: (BeamStoreApi | null)[]): boolean[] {

  // state
  const [_changeVersion, setChangeVersion] = React.useState(0);

  // [effect] monitor the stores for changes
  React.useEffect(() => {
    const updateIfOpenChanges = (state: BeamStore, prevState: BeamStore) => {
      if (state.isOpen !== prevState.isOpen)
        setChangeVersion(version => version + 1);
    };

    // monitor the open status of all stores
    const unsubscribes = beamStores.filter(store => !!store).map((beamStore) => {
      return beamStore?.subscribe(updateIfOpenChanges);
    });

    // unsubscribe on cleanup or when the stores change
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe?.());
  }, [beamStores]);

  return useShallowStable(beamStores.map(beamStore => beamStore?.getState().isOpen ?? false));
}