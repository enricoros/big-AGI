import { createStore as createVanillaStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';

import { createModelsServiceForVendor } from '~/modules/llms/vendors/vendor.helpers';
import { findAllModelVendors } from '~/modules/llms/vendors/vendors.registry';
import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';
import { llmsUpdateModelsForServiceOrThrow } from '~/modules/llms/llm.client';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { llmsStoreActions, llmsStoreState } from '~/common/stores/llms/store-llms';


interface AutoConfStore {

  // state
  isConfiguring: boolean;
  isConfigurationDone: boolean;
  lastSeenBackendEnvHash: string;

  // actions
  initiateConfiguration: () => Promise<void>;

}


const autoConfVanillaStore = createVanillaStore<AutoConfStore>()(persist((_set, _get) => ({

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
    let configurableVendors = findAllModelVendors()
      .filter(vendor => vendor.hasBackendCapKey && backendCaps[vendor.hasBackendCapKey]);

    // List to keep track of the service IDs in order
    const configuredServiceIds: DModelsServiceId[] = [];

    // Sequentially auto-configure each vendor
    await configurableVendors.reduce(async (promiseChain, vendor) => {
      return promiseChain
        .then(async () => {

          // find the first service for this vendor
          const { sources: modelsServices, addService } = llmsStoreState();
          let service: DModelsService;
          const firstServiceForVendor = modelsServices.find(s => s.vId === vendor.id);
          if (!firstServiceForVendor) {
            // create and append the model service, assuming the backend configuration will be successful
            service = createModelsServiceForVendor(vendor.id, modelsServices);
            addService(service);
            // re-find it now that it's added
            service = llmsStoreState().sources.find(_s => _s.id === service.id)!;
          } else
            service = firstServiceForVendor;

          // keep track of the configured service IDs
          configuredServiceIds.push(service.id);

          // auto-configure this service
          await llmsUpdateModelsForServiceOrThrow(service.id, true);
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

    // Re-rank the LLMs based on the order of configured services
    llmsStoreActions().rerankLLMsByServices(configuredServiceIds);

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
