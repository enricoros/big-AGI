import * as React from 'react';
import { create } from 'zustand';


// configuration
const STRICT_OVERLAY_CHECKS = process.env.NODE_ENV === 'development';


interface OverlayState {
  overlays: OverlayItem[];
}

interface OverlayItem {
  id: GlobalOverlayId;
  component: React.ReactNode;
  // rejectFn: (reason: any) => void;
}

export type GlobalOverlayId = // string - disabled so we keep an orderliness
  | 'chat-attachments-clear'
  | 'chat-delete-confirmation'
  | 'chat-reset-confirmation'
  | 'chat-message-delete-confirmation'
  | 'livefile-overwrite'
  | 'shortcuts-confirm-close'
  | 'blocks-off-enhance-code'
  | 'llms-service-remove'
  | 'composer-unsupported-attachments'    // The LLM does not seem to support this mime type - continue anyway?
  | 'composer-open-or-attach'             // Open a file or attach it to the chat?
// | 'agi-patch-workflow-save' // make sure we use it
  ;

interface OverlayActions {
  overlayExists: (id: GlobalOverlayId) => boolean;
  appendOverlay: (id: GlobalOverlayId, component: React.ReactNode) => void;
  removeOverlay: (id: GlobalOverlayId) => void;
  overlayToFront: (id: GlobalOverlayId) => void;
  // removeOverlaysBy: (predicate: (item: OverlayItem) => boolean) => void;
}

export const useLayoutOverlaysStore = create<OverlayState & OverlayActions>((set, get) => ({

  // state
  overlays: [],

  // actions

  overlayExists: (id) => get().overlays.some(o => o.id === id),

  appendOverlay: (id, component) =>
    set(state => {

      // sanity check: don't allow duplicate IDs
      if (state.overlayExists(id)) {
        if (STRICT_OVERLAY_CHECKS)
          throw new Error(`appendOverlay: Overlay ID "${id}" already exists`);
        else
          console.warn(`Overlay ID "${id}" already exists`);
      }

      return {
        overlays: [
          ...state.overlays,
          { id, component },
        ],
      };
    }),

  /**
   * This MUST only be called in the context of the calling hook, not by other parties, as it would leave
   * the promises hangind.
   * In this regard, these functions are just dumb for component insertion/removal.
   */
  removeOverlay: (id) =>
    set(state => {
      // sanity check: don't allow removal of non-existent overlays
      if (!state.overlayExists(id)) {
        if (STRICT_OVERLAY_CHECKS)
          throw new Error(`removeOverlay: Overlay ID "${id}" does not exist`);
        else
          console.warn(`Overlay ID "${id}" does not exist`);
      }

      // if (overlay && reason)
      //   overlay.rejectFn(reason);
      return {
        overlays: state.overlays.filter(o => o.id !== id),
      };
    }),

  /**
   * Bring the overlay to the front, which means to move it to the end of the list.
   * @param id
   */
  overlayToFront: (id) =>
    set(state => {
      if (!state.overlayExists(id)) {
        if (STRICT_OVERLAY_CHECKS)
          throw new Error(`overlayToFront: Overlay ID "${id}" does not exist`);
        else
          console.warn(`Overlay ID "${id}" does not exist`);
        return state; // Return the current state without changes
      }

      const overlay = state.overlays.find(o => o.id === id);
      if (!overlay) return state; // This shouldn't happen due to the check above, but TypeScript doesn't know that
      console.log('reordering');
      return {
        overlays: [
          ...state.overlays.filter(o => o !== overlay),
          overlay,
        ],
      };
    }),

  // removeOverlaysBy: (predicate) =>
  //   set(state => {
  //     // const overlaysToRemove = state.overlays.filter(predicate);
  //     // overlaysToRemove.forEach(overlay => {
  //     //   if (reason)
  //     //     overlay.rejectFn(reason);
  //     // });
  //     return {
  //       overlays: state.overlays.filter(o => !predicate(o)),
  //     };
  //   }),

}));
