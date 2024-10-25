import { getTTSEngine } from './useTTSStore';
import { findTTSVendor } from './vendors/vendors.registry';

export function TTSSetting() {
  const TTSEngine = getTTSEngine();
  const vendor = findTTSVendor(TTSEngine);
  if (!vendor || !vendor.TTSSettingsComponent) {
    return <></>;
  }
  return <vendor.TTSSettingsComponent />;
}
