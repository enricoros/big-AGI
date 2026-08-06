import { create } from 'zustand/index';
import { persist } from 'zustand/middleware';

import { agiId } from '~/common/util/idUtils';
import { generateDeviceName, isBrowser, isPwa } from '~/common/util/pwaUtils';


/// Store ///

interface PerClientStore {

  /**
   * Global (same per each users in this browser/device) device identifier.
   */
  localDeviceId: string;

}

const useDeviceStore = create<PerClientStore>()(persist(
  () => ({

    // initial state
    localDeviceId: '',

  }),
  {
    name: 'app-device',
    version: 1,
  },
));


/// Global Device ID ///

/**
 * Gets or generates the global device ID (hardware-specific).
 * This ID is shared across all users on the same device.
 * Thread-safe: multiple calls return the same ID.
 */
export function deviceGetGlobalDeviceId(): string {
  // SSR: return a dummy id
  if (!isBrowser) return 'ssr-dummy-device-id';

  let { localDeviceId } = useDeviceStore.getState();

  // Return existing ID if available
  if (localDeviceId)
    return localDeviceId;

  // Generate new ID and persist
  localDeviceId = _generateLocalDeviceIdentifier();
  useDeviceStore.setState({ localDeviceId });
  return localDeviceId;
}


/// Device/ID functions ///

interface DeviceRegistrationClientPayload {
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
  return {
    deviceId: deviceGetGlobalDeviceId(),
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
 *
 * NOTE: This is the hardware device ID used for device registration only.
 * Vector clocks can use a separate user-scoped device ID generated server-side
 * to prevent conflicts when multiple users share the same device.
 */
function _generateLocalDeviceIdentifier(): string {
  // Generate 6 random characters
  const random = agiId('vector-device-id10').slice(0, 6);

  // Use a 4 char suffix from current timestamp
  const timestamp = Date.now().toString(36).slice(-4);

  // Combine for a total of 10 characters
  return random + timestamp;
}
