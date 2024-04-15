import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';

import { DModelSource, useModelsStore } from '~/modules/llms/store-llms';
import { createModelSourceForVendor, findAllVendors } from '~/modules/llms/vendors/vendors.registry';
import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';
import { llmsUpdateModelsForSourceOrThrow } from '~/modules/llms/llm.client';


interface AutoConfStore {

  // state
  isConfiguring: boolean;
  isConfigurationDone: boolean;
  lastSeenBackendEnvHash: string;

  // actions
  initiateConfiguration: () => Promise<void>;

}


const autoConfVanillaStore = createStore<AutoConfStore>()(persist((_set, _get) => ({

  // init state
  isConfiguring: false,
  isConfigurationDone: false,
  lastSeenBackendEnvHash: '',


  initiateConfiguration: async () => {
    // Note: double-calling is only expected to happen in react strict mode
    const { isConfiguring, isConfigurationDone, lastSeenBackendEnvHash } = _get();
    if (isConfiguring || isConfigurationDone)
      return;

    // skip if no change is detected / no config needed
    const backendCaps = getBackendCapabilities();
    const backendHash = backendCaps.llmConfigHash;
    if (!backendHash || backendHash === lastSeenBackendEnvHash)
      return _set({ isConfiguring: false, isConfigurationDone: true });

    // begin configuration
    _set({ isConfiguring: true, lastSeenBackendEnvHash: backendHash });

    // find
    let configurableVendors = findAllVendors()
      .filter(vendor => vendor.hasBackendCapKey && backendCaps[vendor.hasBackendCapKey]);

    // Sequentially auto-configure each vendor
    await configurableVendors.reduce(async (promiseChain, vendor) => {
      return promiseChain
        .then(async () => {

          // find the first source for this vendor
          const { sources, addSource } = useModelsStore.getState();
          let source: DModelSource;
          const fistSourceForVendor = sources.find(source => source.vId === vendor.id);
          if (fistSourceForVendor)
            source = fistSourceForVendor;
          else {
            // create and append the model source, assuming the backend configuration will be successful
            source = createModelSourceForVendor(vendor.id, sources);
            addSource(source);
            source = useModelsStore.getState().sources.find(_s => _s.id === source.id)!;
          }

          // auto-configure this source
          await llmsUpdateModelsForSourceOrThrow(source.id, true);
        })
        .catch(error => {
          // catches errors and logs them, but does not stop the chain
          console.error('Auto-configuration failed for vendor:', vendor.name, error);
        })
        .then(() => {
          // short delay between vendors
          return new Promise(resolve => setTimeout(resolve, 50));
        });
    }, Promise.resolve());

    // end configuration
    _set({ isConfiguring: false, isConfigurationDone: true });
  },

}), {
  name: 'app-autoconf',

  // Pre-Saving: remove non-persisted properties
  partialize: ({ lastSeenBackendEnvHash }) => ({
    lastSeenBackendEnvHash,
  }),
}));


export function autoConfInitiateConfiguration() {
  void autoConfVanillaStore.getState().initiateConfiguration();
}
