import * as React from 'react';

import { GlobalOverlayId, useLayoutOverlaysStore } from './store-layout-overlays';


enum OverlayCloseReason {
  USER_REJECTED = 'USER_REJECTED',
  UNMOUNTED = 'UNMOUNTED',
  REPLACED = 'REPLACED',
  ALREADY_SHOWN = 'ALREADY_SHOWN',
}

type OverlayComponentProps<TResolve> = {
  onResolve: (value: TResolve) => void;
  onUserReject: () => void;
};

interface ShowOverlayOptions<TResolve> {
  doNotRejectOnUnmount?: boolean;
  rejectWithValue?: Exclude<TResolve, undefined>; // saves a try/catch in the caller
}


// The type of the function that will be returned by the hook
type TShowPromiseOverlay = <TResolve>(
  overlayId: GlobalOverlayId,
  options: ShowOverlayOptions<TResolve>,
  Component: React.ComponentType<OverlayComponentProps<TResolve>>,
) => Promise<TResolve>;


/**
 * Show overlays with promise-like callbacks. IDs are global and unique, for ease of deduplication.
 * - When the component unmounts, by default it will reject all the overlays that don't have
 *   the `doNotRejectOnUnmount` option set.
 * - When a new overlay is requested, it will check if it's already open and reject it if so,
 *   and bring it to the front.
 */
export function useOverlayComponents(): {
  showPromisedOverlay: TShowPromiseOverlay;
} {

  // keep track of active overlays
  // NOTE: this keeps track of the IDs that are open where this hook is used, while the store keeps track of all the components
  // NOTE2:
  const activeOverlaysRef = React.useRef<{
    id: GlobalOverlayId;
    doReject: (reason: OverlayCloseReason) => void;
  }[]>([]);

  // on unmount, reject all active overlays
  React.useEffect(() => {
    return () => {
      for (const { doReject } of activeOverlaysRef.current)
        doReject(OverlayCloseReason.UNMOUNTED);
      activeOverlaysRef.current = [];
    };
  }, []);

  // create a new overlay component with promise-like callbacks
  const showPromisedOverlay = React.useCallback(<TResolve, >(
    overlayId: GlobalOverlayId,
    options: ShowOverlayOptions<TResolve> = {},
    Component: React.ComponentType<OverlayComponentProps<TResolve>>,
  ): Promise<TResolve> => {
    return new Promise<TResolve>((pResolve, pReject) => {

      const { appendOverlay, overlayExists, overlayToFront, removeOverlay } = useLayoutOverlaysStore.getState();

      // Check if the overlay already exists and exit early
      // This is like doReject, but doesn't remove the overlay as we don't insert it
      if (overlayExists(overlayId)) {

        // Look if we own a reference to the former overlay to replace
        const overlayToReplace = activeOverlaysRef.current.find(o => o.id === overlayId);
        if (!overlayToReplace) {
          console.log(`Note: Overlay "${overlayId}" already exists, but we don't have a reference to it. Recovery successful.`);
          if (options.rejectWithValue !== undefined)
            pResolve(options.rejectWithValue);
          else
            pReject(OverlayCloseReason.ALREADY_SHOWN);
          overlayToFront(overlayId);
          return;
        }

        // if it's one of ours, we reject the existing overlay, and remove it, then continue with adding the new one
        overlayToReplace.doReject(OverlayCloseReason.REPLACED);
      }

      const _doRemove = (): boolean => {
        if (!overlayExists(overlayId))
          return false;
        removeOverlay(overlayId);
        activeOverlaysRef.current = activeOverlaysRef.current.filter(o => o.id !== overlayId);
        return true;
      };

      const doResolve = (value: TResolve) => {
        if (_doRemove())
          pResolve(value);
      };

      const doReject = (reason: OverlayCloseReason) => {
        if (_doRemove()) {
          if (options.rejectWithValue !== undefined)
            pResolve(options.rejectWithValue);
          else
            pReject(reason);
        }
      };

      appendOverlay(overlayId,
        <Component
          onResolve={doResolve}
          onUserReject={() => {
            doReject(OverlayCloseReason.USER_REJECTED);
          }}
        />,
      );

      if (!options.doNotRejectOnUnmount)
        activeOverlaysRef.current.push({ id: overlayId, doReject });
    });
  }, []);

  return { showPromisedOverlay };
}
