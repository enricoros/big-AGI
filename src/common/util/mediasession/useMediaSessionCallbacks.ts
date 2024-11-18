// import * as React from 'react';
//
// import { useShallowStable } from '../hooks/useShallowObject';
//
// import { MediaSessionCallbacks, MediaSessionManager } from './MediaSessionManager';
//
//
// // noinspection JSUnusedGlobalSymbols
// /**
//  * Note: this does not seem to be working as of now.
//  * The reason is possibly related to us not having an <audio> element in the DOM.
//  * @param handlers an object containing zero or more handlers for diverse media session actions
//  */
// export function useMediaSessionCallbacks(handlers: MediaSessionCallbacks) {
//
//   const stableHandlers = useShallowStable(handlers);
//
//   React.useEffect(() => {
//     MediaSessionManager.getInstance().registerComponent(stableHandlers);
//     return () => MediaSessionManager.getInstance().unregisterComponent(stableHandlers);
//   }, [stableHandlers]);
//
// }