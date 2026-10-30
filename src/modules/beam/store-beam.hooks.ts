import { type StoreApi, useStore } from 'zustand';

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
