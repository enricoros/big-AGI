import { create } from 'zustand/index';
import { persist } from 'zustand/middleware';

import { agiId } from '~/common/util/idUtils';
import { generateDeviceName, isBrowser, isPwa } from '~/common/util/pwaUtils';


/// Store ///

interface PerClientStore {
  // individual device identification for multi-device sync
  localDeviceId: string;

  // actions
  getLocalDeviceId: () => string;
}

const useDeviceStore = create<PerClientStore>()(persist(
  (set, get) => ({
    // initial state
    localDeviceId: '',

    // actions
    getLocalDeviceId: () => {
      // use existing ID
      let { localDeviceId } = get();
      if (localDeviceId) return localDeviceId;

      // or generate new, once per device
      localDeviceId = generateLocalDeviceIdentifier();
      set({ localDeviceId });
      return localDeviceId;
    },
  }),
  {
    name: 'app-device',
    version: 1,
  },
));


/// Device/ID functions ///

export interface DeviceRegistrationClientPayload {
  deviceId: string;               // device identifier for sync
  deviceName: string;             // human-readable name
  environment: {
    language: string;
    timezone: string;
    screen: string;               // screen resolution
    form: 'web' | 'pwa' | 'app';  // format of the client
  };
}

/**
 * Creates a complete device registration payload when needed
 * Nothing except the deviceId is stored locally
 */
export function deviceCreateRegistrationPayload(): DeviceRegistrationClientPayload {
  const deviceId = useDeviceStore.getState().getLocalDeviceId();
  return {
    deviceId,
    deviceName: generateDeviceName(),
    // generated at call time, server-side checked for consistency
    environment: {
      language: navigator.language || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      screen: (isBrowser && window.screen?.width && window.screen?.height) ? `${window.screen.width}x${window.screen.height}` : '',
      form: isPwa() ? 'pwa' : 'web',
    },
  };
}

/**
 * Generates a local device identifier for sync capabilities.
 * This ID combines a timestamp component with random characters for patterned uniqueness.
 *
 * Format: 6 random chars + 4 timestamp chars = 10 chars total
 * Example: "a7f3g9h812"  (where "12" is from the timestamp)
 *
 * This ID is only used to distinguish between devices during sync operations.
 * It never leaves your device/browser unless you explicitly enable sync functionality.
 */
function generateLocalDeviceIdentifier(): string {
  // Generate 6 random characters
  const random = agiId('vector-device-id10').slice(0, 6);

  // Use a 4 char suffix from current timestamp
  const timestamp = Date.now().toString(36).slice(-4);

  // Combine for a total of 10 characters
  return random + timestamp;
}
