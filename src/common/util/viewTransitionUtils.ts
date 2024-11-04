// import { flushSync } from 'react-dom';
//
//
// // Provide the missing definition for this novel API
//
// // Extend the global Document interface
// declare global {
//   interface Document {
//     startViewTransition(updateCallback: UpdateCallback): ViewTransition;
//   }
// }
//
// type UpdateCallback = () => Promise<any>;
//
// interface ViewTransition {
//   readonly updateCallbackDone: Promise<undefined>;
//   readonly ready: Promise<undefined>;
//   readonly finished: Promise<undefined>;
//
//   skipTransition(): undefined;
// }
//
//
// // Perform a view transition, if supported by the browser
// export async function performViewTransition<T>(callback: () => T) {
//
//   // If the browser does not support view transitions, just call the callback
//   if (!('startViewTransition' in document))
//     return callback();
//
//   // Transition to the new view
//   const viewTransition = document.startViewTransition(async () => {
//     if (typeof flushSync !== 'function')
//       return callback();
//     return flushSync(() => callback());
//   });
//
//   // Wait for the transition to be ready
//   // await viewTransition.ready;
// }
