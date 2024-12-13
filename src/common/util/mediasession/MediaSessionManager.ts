// import { Brand } from '~/common/app.config';
//
//
// type MediaSessionAction = 'play' | 'pause' | 'stop' | 'seekbackward' | 'seekforward' | 'previoustrack' | 'nexttrack';
// export type MediaSessionCallbacks = Partial<Record<MediaSessionAction, () => void>>;
//
//
// export class MediaSessionManager {
//
//   private static instance: MediaSessionManager;
//
//   private handlers: Record<MediaSessionAction, Set<() => void>> = {
//     play: new Set(),
//     pause: new Set(),
//     stop: new Set(),
//     seekbackward: new Set(),
//     seekforward: new Set(),
//     previoustrack: new Set(),
//     nexttrack: new Set(),
//   };
//
//   private constructor() {
//     if (!('mediaSession' in navigator)) {
//       console.warn('Media Session API is not supported in this browser.');
//     }
//   }
//
//   public static getInstance(): MediaSessionManager {
//     if (!MediaSessionManager.instance) {
//       MediaSessionManager.instance = new MediaSessionManager();
//     }
//     return MediaSessionManager.instance;
//   }
//
//   public registerComponent(handlers: MediaSessionCallbacks): void {
//     Object.entries(handlers).forEach(([action, handler]) => {
//       if (handler) {
//         this.handlers[action as MediaSessionAction].add(handler);
//       }
//     });
//     this.applyHandlers();
//   }
//
//   public unregisterComponent(handlers: MediaSessionCallbacks): void {
//     Object.entries(handlers).forEach(([action, handler]) => {
//       if (handler) {
//         this.handlers[action as MediaSessionAction].delete(handler);
//       }
//     });
//     this.applyHandlers();
//   }
//
//   private applyHandlers(): void {
//     if (!('mediaSession' in navigator)) return;
//
//     // check if we have any callbacks to set
//     const isEmpty = Object.values(this.handlers).every(handlers => handlers.size === 0);
//
//     // set Metadata, so that the world is notified of the presence of this global shortcut
//     if (isEmpty) {
//       if (navigator.mediaSession.metadata)
//         navigator.mediaSession.metadata = null;
//     } else {
//       if (!navigator.mediaSession.metadata)
//         navigator.mediaSession.metadata = new MediaMetadata({
//           title: Brand.Title.Common,
//           artist: Brand.Title.Base,
//           album: Brand.Title.Base,
//         });
//     }
//
//     // add callbacks (even cascading ones for multiple registrations)
//     (Object.keys(this.handlers) as MediaSessionAction[]).forEach(action => {
//       const handlers = this.handlers[action];
//       if (handlers.size > 0) {
//         navigator.mediaSession.setActionHandler(action, () => {
//           handlers.forEach(handler => handler());
//         });
//       } else {
//         navigator.mediaSession.setActionHandler(action, null);
//       }
//     });
//   }
//
// }