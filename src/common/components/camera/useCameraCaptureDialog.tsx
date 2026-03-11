import * as React from 'react';

import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import type { CameraCaptureResult } from './useCameraCapture';
import { CameraCaptureModal } from './CameraCaptureModal';


export type CameraCaptureDialogOptions = {
  /** show [+] button to queue multiple captures */
  allowMultiCapture?: boolean;
  /** show small Record button alongside Capture */
  allowLiveFeed?: boolean;
  /** only show a prominent Record button (no Capture/Add) */
  liveFeedOnly?: boolean;
};


/**
 * Returns a function to open the camera overlay dialog.
 * Resolves with null if dismissed empty, or CameraCaptureResult (images + optional live stream).
 */
export function useCameraCaptureDialog() {

  // external state
  const { showPromisedOverlay } = useOverlayComponents();

  const openCameraCapture = React.useCallback((options?: CameraCaptureDialogOptions): Promise<CameraCaptureResult | null> =>
    showPromisedOverlay<CameraCaptureResult | null>('camera-capture', { rejectWithValue: null }, ({ onResolve }) => (
      <CameraCaptureModal
        allowMultiCapture={options?.allowMultiCapture}
        allowLiveFeed={options?.allowLiveFeed}
        liveFeedOnly={options?.liveFeedOnly}
        onDone={onResolve}
      />
    )), [showPromisedOverlay]);

  return { openCameraCapture };
}