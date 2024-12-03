import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { agiId } from '~/common/util/idUtils';
import { isBrowser } from '~/common/util/pwaUtils';

import type { VectorClockNodeId } from './vectorclock.types';


interface SyncStore {

  vectorClockNode: null | {

    // unique id for this device, used to track changes, only statistically unique within the user space
    nodeId: VectorClockNodeId;

    // basic device fingerprint stored once at creation
    createdAt: number;
    userAgent: string;

  };

}


const useSyncStore = create<SyncStore>()(persist(
  (_set, _get) => ({

    // initial state
    vectorClockNode: null,

  }),
  {
    name: 'app-sync',
    version: 1,
  },
));


export function getVectorClockNodeId() {
  const exClient = useSyncStore.getState().vectorClockNode;
  if (exClient) return exClient.nodeId;

  // this will be created once per browser
  const vectorClockNode = {
    nodeId: agiId('vector-device-id10'),
    createdAt: Date.now(),
    userAgent: isBrowser ? window.navigator?.userAgent || '' : '',
  };

  useSyncStore.setState({ vectorClockNode });

  return vectorClockNode.nodeId;
}
