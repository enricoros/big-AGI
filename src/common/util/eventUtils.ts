// /**
//  * Generates helper functions for dispatching and listening to custom Browser events with typed details.
//  *
//  * @param eventName The base name of the event. The actual event type will be `${eventName}Event`.
//  * @returns A tuple containing two functions:
//  * 1. `dispatchEvent(target: EventTarget, detail: TDetail) => void` - Dispatches the custom event on the specified target with the provided detail.
//  * 2. `installListener(target: EventTarget, listener: (detail: TDetail) => void) => () => void` - Installs an event listener on the specified target that listens for the custom event and executes the provided callback with the event detail. Returns a function to remove the installed event listener.
//  * @template TDetail The type of the detail object that will be passed with the event.
//  */
// export function customEventHelpers<TDetail>(eventName: string): [dispatchEvent: (target: EventTarget, detail: TDetail) => void, installListener: (state: TDetail, target: EventTarget, listener: (detail: TDetail) => void) => () => void] {
//   const eventType = `${eventName}Event`;
//
//   const createEvent = (detail: TDetail): CustomEvent<TDetail> => new CustomEvent<TDetail>(eventType, { detail: detail });
//
//   const dispatchEvent = (target: EventTarget, detail: TDetail) => target.dispatchEvent(createEvent(detail));
//
//   const installListener = (currentState: TDetail, target: EventTarget, detailListener: (detail: TDetail) => void) => {
//     const listener = (event: Event) => detailListener((event as CustomEvent<TDetail>).detail);
//     detailListener(currentState);
//     target.addEventListener(eventType, listener);
//     return () => target.removeEventListener(eventType, listener);
//   };
//
//   return [dispatchEvent, installListener];
// }
