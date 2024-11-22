import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { agiId } from '~/common/util/idUtils';
import { isBrowser } from '~/common/util/pwaUtils';


type VectorClientDeviceId = string;

interface VectorClient {

  // The critical ID used in vector clocks
  vectorId: VectorClientDeviceId;

  // Basic device fingerprint stored once at creation
  createdAt: number;
  userAgent: string;

}


interface StoreSync {

  client: VectorClient | null;

  getVectorDeviceId: () => string;

}


const useSyncStore = create<StoreSync>()(persist(
  (_set, _get) => ({

    client: null,

    getVectorDeviceId: () => {
      const exClient = _get().client;
      if (exClient) return exClient.vectorId;

      // this will be created once per browser
      const client = {
        vectorId: agiId('vector-device-id10'),
        createdAt: Date.now(),
        userAgent: isBrowser ? window.navigator?.userAgent || '' : '',
      };

      _set({ client });

      return client.vectorId;
    },

  }),
  {
    name: 'app-sync',
    version: 1,
  },
));

// Quick access for vector clocks
export const getVectorDeviceId = () => {
  return useSyncStore.getState().getVectorDeviceId();
};
