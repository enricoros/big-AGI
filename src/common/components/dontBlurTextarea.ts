import * as React from 'react';


/**
 * onMouseDown guard for buttons that act on a focused textarea (mic, new chat, etc.):
 * preventing the default keeps focus - and the caret, and focus-scoped shortcuts - where
 * the user is typing. Module-level pure function: one stable reference, no hook needed.
 */
export function dontBlurTextareaOnMouseDown(event: React.MouseEvent): void {
  if (document.activeElement?.tagName === 'TEXTAREA')
    event.preventDefault();
}
