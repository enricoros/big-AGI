import * as React from 'react';

import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import { CameraCaptureModal } from './CameraCaptureModal';


/**
 * Returns a function to open the camera overlay dialog.
 */
export function useCameraCaptureDialog() {

  // external state
  const { showPromisedOverlay } = useOverlayComponents();

  const openCameraCapture = React.useCallback((): Promise<File | null> =>
    showPromisedOverlay<File | null>('camera-capture', { rejectWithValue: null }, ({ onResolve, onUserReject }) => (
      <CameraCaptureModal onCloseModal={onUserReject} onAttachImage={onResolve} />
    )), [showPromisedOverlay]);

  return { openCameraCapture };
}