import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Slider } from '@mui/joy';
import ZoomInIcon from '@mui/icons-material/ZoomIn';

import { Is } from '~/common/util/pwaUtils';


// --- Camera capture (files or feed) Types  ---

/**
 * Result of a camera capture session. Returned when the modal closes.
 * - images: accumulated captures (via "+" and/or "Capture" button)
 * - liveStream: if the user started a live feed, the detached stream
 */
export interface CameraCaptureResult {
  images: File[];
  liveStream?: CameraLiveStream;
}

export interface CameraLiveStream {
  // fundamental
  stream: MediaStream;
  // cosmetic
  deviceId: string;
  deviceLabel: string;
  width?: number;
  height?: number;
  frameRate?: number;
}


// --- Capability (not presence) check ---

export function supportsCameraCapture(): boolean {
  return !!(navigator?.mediaDevices?.getUserMedia);
}

export function buildCameraConstraints(deviceId: string): MediaStreamConstraints {
  return {
    video: {
      deviceId: deviceId,
      width: { ideal: 1920 },
      height: { ideal: 1440 },
      frameRate: { ideal: 30 },
      // resizeMode: 'crop-and-scale',
      zoom: true, // request zoom capability
    },
    // audio: false, // shall we ask for this? what's the default?
  } as MediaStreamConstraints & { video: { zoom: boolean } };
}


// Controller state - immutable snapshots for useSyncExternalStore

interface _CameraControllerState {
  cameras: MediaDeviceInfo[];
  cameraIdx: number;
  zoom: { min: number; max: number; step: number } | null;
  info: string | null;
  error: string | null;
}


/**
 * CameraController - manages camera stream lifecycle outside of React.
 *
 * Uses an epoch counter to handle async races: every intent (start, stop, detach,
 * dispose) bumps the epoch. When getUserMedia resolves, it checks if the epoch
 * still matches. If not, the stream is immediately discarded.
 *
 * This avoids all React strict mode and rapid-interaction races without
 * requiring a command queue - stale operations simply self-destruct.
 */
class CameraController {

  // observable state
  private _listeners = new Set<() => void>();
  private _state: _CameraControllerState = {
    cameras: [],
    cameraIdx: -1,
    zoom: null,
    info: null,
    error: null,
  };

  // stream lifecycle
  private _epoch = 0;
  private _disposed = true;
  private _stream: MediaStream | null = null;
  private _videoTrack: MediaStreamTrack | null = null;

  // device listener cleanup
  private _permissionStatus: PermissionStatus | null = null;

  constructor(private readonly _videoRef: React.RefObject<HTMLVideoElement | null>) {
  }


  // -- State emitter for useSyncExternalStore --

  getSnapshot = (): _CameraControllerState => this._state;

  subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  };

  private _setState(patch: Partial<_CameraControllerState>) {
    this._state = { ...this._state, ...patch };
    this._listeners.forEach((l) => l());
  }


  // -- Lifecycle (called by React effect) --

  mount() {
    this._disposed = false;

    if (!supportsCameraCapture()) return;

    this.#enumerateAndStart();

    // Listen for device changes (e.g. camera added/removed)
    navigator.mediaDevices
      .addEventListener('devicechange', this.#enumerateAndStart);

    // Listen for permission changes (e.g. user grants camera access)
    if (navigator.permissions?.query)
      navigator.permissions
        .query({ name: 'camera' })
        .then((status) => {
          if (this._disposed) return;
          this._permissionStatus = status;
          status.onchange = () => {
            if (status.state === 'granted' || status.state === 'prompt')
              this.#enumerateAndStart();
          };
        })
        .catch((error) => {
          console.warn('[DEV] CameraController: permissions error:', error);
        });
  }

  dispose() {
    this._disposed = true;

    this.#releaseStreamIfAny();

    // stop listening for device changes
    navigator.mediaDevices?.removeEventListener('devicechange', this.#enumerateAndStart);

    // stop listening for permission changes
    if (this._permissionStatus) {
      this._permissionStatus.onchange = null; // be clear about removing the permission listener
      this._permissionStatus = null;
    }
  }


  // -- Public API --

  selectCameraAndStart = (idx: number) => {
    // no-op if selecting the same camera
    if (idx === this._state.cameraIdx) return;

    const device = idx !== -1 ? (this._state.cameras[idx] ?? null) : null;

    this._setState({ cameraIdx: idx });

    if (!device) {
      this.#releaseStreamIfAny();
      return;
    }

    // -> epoch protection handles races if another select/dispose occurs
    void this.#startCamera(device);
  };

  applyZoomValue = (value: number) => {
    this._videoTrack?.applyConstraints?.({ advanced: [{ zoom: value }] } as any);
  };

  /**
   * Advanced: detach the stream without stopping it - transfers ownership to the caller.
   * Bumps epoch to neuter any in-flight requests.
   */
  detachStream = (): CameraLiveStream | null => {
    // Always bump epoch to neuter in-flight requests
    this._epoch++;

    const stream = this._stream;
    const track = this._videoTrack;
    if (!stream) return null;

    // relinquish without stopping
    this._stream = null;
    this._videoTrack = null;
    // remove from any video element without stopping (camera light is still on)
    if (this._videoRef.current)
      this._videoRef.current.srcObject = null;

    // gather track info for the caller
    const settings = track?.getSettings();
    const { cameras, cameraIdx } = this._state;
    const device = cameraIdx !== -1 ? cameras[cameraIdx] : undefined;

    this._setState({ zoom: null, error: null });

    return {
      stream, // fundamental
      // optional, cosmetic
      deviceId: device?.deviceId || settings?.deviceId || '',
      deviceLabel: device?.label || track?.label || '',
      width: settings?.width,
      height: settings?.height,
      frameRate: settings?.frameRate,
    };
  };


  // -- Internal logic: enumeration and stream management (with epoch protection) --

  #enumerateAndStart = () => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {

        // disposed while enumerating (e.g. modal closed during getUserMedia prompt)
        if (this._disposed) return;

        // get video devices
        const videoDevices = devices.filter((device) => device.kind === 'videoinput');

        // handle no cameras
        if (!videoDevices.length) {
          this.#releaseStreamIfAny();
          this._setState({ cameras: [], cameraIdx: -1, error: 'No cameras found' });
          return;
        }

        // Auto-select: prefer back camera on first run, keep existing selection
        const prevIdx = this._state.cameraIdx;
        let newIdx: number;
        if (prevIdx === -1) {
          // first run: prefer back camera
          const backIdx = videoDevices
            .map((d) => d.label)
            .findLastIndex((label) => {
              if (Is.OS.iOS) return label.toLowerCase().includes('back camera');
              return label.toLowerCase().includes('back') || label.toLowerCase().includes('rear');
            });
          newIdx = backIdx >= 0 ? backIdx : 0;
        } else {
          // keep existing index, clamped down to the valid range (devices may have been removed)
          newIdx = Math.min(prevIdx, videoDevices.length - 1);
        }

        this._setState({ cameras: videoDevices, cameraIdx: newIdx, error: null });

        // -> epoch protection handles race conditions
        void this.#startCamera(videoDevices[newIdx]);

      })
      .catch((error) => {
        if (this._disposed) return; // swallow errors after dispose
        console.warn('[DEV] CameraController: enumerateDevices error:', error);
        this._setState({ error: error.message });
      });
  };

  async #startCamera(device: MediaDeviceInfo) {
    // synchronous: kill current stream + invalidate all in-flight requests
    this.#releaseStreamIfAny();
    const myEpoch = ++this._epoch;
    this._setState({ error: null, info: null, zoom: null });

    // check for camera access
    if (!supportsCameraCapture()) {
      this._setState({ error: 'Browser has no camera access' });
      return;
    }

    try {

      // acquire MediaStream
      const stream = await navigator.mediaDevices
        .getUserMedia(buildCameraConstraints(device.deviceId));

      // stale-gate: if epoch changed during the await, discard the stream
      if (this._epoch !== myEpoch) {
        // console.log('[DEV] CameraController: discarding stale stream', this._epoch, myEpoch);
        return stream.getTracks().forEach((t) => t.stop());
      }

      // get the video track (there should be exactly one)
      const [track] = stream.getVideoTracks();
      if (!track) {
        stream.getTracks().forEach((t) => t.stop());
        return this._setState({ error: 'No video track found in the stream' });
      }

      // install the stream
      this._stream = stream;
      this._videoTrack = track;
      // display the stream to the html video element, if given and mounted
      if (this._videoRef.current)
        this._videoRef.current.srcObject = stream;

      // Extract capabilities and settings for info and zoom control
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
        zoom?: { min: number; max: number; step: number };
      };
      const settings = track.getSettings();
      this._setState({
        zoom: typeof capabilities.zoom === 'object' ? capabilities.zoom : null,
        info: `Camera Settings:\n${JSON.stringify(settings, null, 2)}\n\nCamera Capabilities:\n${JSON.stringify(capabilities, null, 2)}`,
      });

    } catch (error: any) {
      if (this._epoch !== myEpoch) return; // swallow stale errors
      this._setState({
        error: error.name === 'NotAllowedError' ? 'Camera access denied, please grant permissions.' : error.message,
      });
    }
  }

  #releaseStreamIfAny() {
    // bump epoch (neutering in-flight requests)
    this._epoch++;

    // detach from video element first, if being viewed
    if (this._videoRef.current)
      this._videoRef.current.srcObject = null;

    // then stop the tracks
    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
      this._stream = null;
      this._videoTrack = null;
    }
  }

}


// Zoom slider style

const sliderContainerSx: SxProps = {
  fontSize: 'sm',
  display: 'flex',
  alignItems: 'center',
  mx: 0.75,
  gap: 3,
};


/**
 * React hook for camera device interaction.
 *
 * Delegates all async stream lifecycle to CameraController (epoch-protected),
 * keeping React effects minimal and race-condition-free.
 */
export function useCameraCapture() {

  // refs
  const extVideoRef = React.useRef<HTMLVideoElement>(null); // set externally on the <video> element

  // state: stable controller instance (survives strict mode remounts)
  const _controllerRef = React.useRef<CameraController | null>(null);
  if (!_controllerRef.current) _controllerRef.current = new CameraController(extVideoRef);
  const controller = _controllerRef.current;

  // external state
  const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot /*, never SSR */);


  // [effect] lifecycle
  React.useEffect(() => {
    controller.mount();
    return () => controller.dispose();
  }, [controller]);


  // memo zoom components wrapping/mutating internal state
  const zoomComponent = React.useMemo(() => {
    if (!state.zoom?.max) return null;
    const { min, max, step } = state.zoom;
    return (
      <Box sx={sliderContainerSx}>
        <span>Zoom:</span>
        <Slider
          variant='solid'
          color='neutral'
          size='lg'
          defaultValue={1}
          min={min} max={max} step={step}
          onChange={(_event, value) => typeof value === 'number' && controller.applyZoomValue(value)}
        />
        <ZoomInIcon opacity={0.5} />
      </Box>
    );
  }, [controller, state.zoom]);

  return {
    // the html video element to show this on
    videoRef: extVideoRef,
    // list and select camera
    cameras: state.cameras,
    cameraIdx: state.cameraIdx,
    setCameraIdx: controller.selectCameraAndStart,
    detachStream: controller.detachStream,
    zoomControl: zoomComponent,
    info: state.info,
    error: state.error,
  };
}