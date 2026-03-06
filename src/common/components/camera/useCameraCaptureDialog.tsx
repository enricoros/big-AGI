import * as React from 'react';

import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import type { CameraCaptureResult } from './useCameraCapture';
import { CameraCaptureModal } from './CameraCaptureModal';


/**
 * Returns a function to open the camera overlay dialog.
 * Resolves with null if dismissed empty, or CameraCaptureResult (images + optional live stream).
 */
export function useCameraCaptureDialog() {

  // external state
  const { showPromisedOverlay } = useOverlayComponents();

  const openCameraCapture = React.useCallback((options?: { allowMultiCapture?: boolean; allowLiveFeed?: boolean }): Promise<CameraCaptureResult | null> =>
    showPromisedOverlay<CameraCaptureResult | null>('camera-capture', { rejectWithValue: null }, ({ onResolve }) => (
      <CameraCaptureModal
        allowMultiCapture={options?.allowMultiCapture}
        allowLiveFeed={options?.allowLiveFeed}
        onDone={onResolve}
      />
    )), [showPromisedOverlay]);

  return { openCameraCapture };
}