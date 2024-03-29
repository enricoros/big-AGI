import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';
import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';


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
    if (!backendHash || backendHash === lastSeenBackendEnvHash) {
      console.log('No backend configuration hash found or no change detected. Skipping...');
      return _set({ isConfiguring: false, isConfigurationDone: true });
    }

    // begin configuration
    _set({ isConfiguring: true, lastSeenBackendEnvHash: backendHash });




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
