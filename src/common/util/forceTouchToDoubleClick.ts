// /**
//  * Force Touch to Double Click - Mac trackpad force press triggers edit
//  *
//  * Converts force touch (deep press on Mac trackpads) into synthetic
//  * double-click events, enabling edit mode via force press.
//  *
//  * Architecture:
//  * - One-time global setup converts force touch → synthetic dblclick
//  * - Elements mark themselves with data-edit-intent attribute
//  * - Regular onDoubleClick handlers catch both real and synthetic events
//  *
//  * Usage:
//  * 1. Call initForceTouchToDoubleClick() once at app startup
//  * 2. Add data-edit-intent attribute to editable elements
//  * 3. Use regular onDoubleClick handler - it catches both
//  */
//
// // Feature detection - cached
// let _forceTouchSupported: boolean | null = null;
// const supportsForceTouch = (): boolean =>
//   (_forceTouchSupported ??= typeof MouseEvent !== 'undefined' && 'webkitForce' in MouseEvent.prototype);
//
// // One-time global setup
// let _initialized = false;
//
// /**
//  * Initialize force touch to double-click conversion.
//  * Safe to call multiple times - guards against re-initialization.
//  */
// function initForceTouchToDoubleClick(): void {
//   if (_initialized || typeof document === 'undefined' || !supportsForceTouch()) return;
//   _initialized = true;
//
//   // Opt-in to force events on marked elements
//   document.addEventListener('webkitmouseforcewillbegin', (e) => {
//     if ((e.target as HTMLElement).closest?.('[data-edit-intent]')) {
//       e.preventDefault();
//     }
//   }, { capture: true });
//
//   // Force touch → synthetic double-click
//   document.addEventListener('webkitmouseforcedown', (e) => {
//     const target = (e.target as HTMLElement).closest?.('[data-edit-intent]');
//     if (target) {
//       const me = e as MouseEvent;
//       target.dispatchEvent(new MouseEvent('dblclick', {
//         bubbles: true,
//         cancelable: true,
//         view: window,
//         clientX: me.clientX,
//         clientY: me.clientY,
//       }));
//     }
//   });
// }
//
// // Auto-initialize when this module is imported
// initForceTouchToDoubleClick();
