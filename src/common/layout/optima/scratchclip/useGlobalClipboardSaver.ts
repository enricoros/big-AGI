import * as React from 'react';

import { scratchClipActions } from './store-scratchclip';


// basic check for typical editable elements
function isTargetTypicallyEditable(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable || false
  );
}


export function useGlobalClipboardSaver(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;

    const handleClipboardAction = (event: ClipboardEvent) => {
      const targetElement = event.target as HTMLElement | null;

      // ensure the event originated from within our document body
      if (!targetElement || !document.body.contains(targetElement)) {
        return;
      }

      // try to get text from clipboardData first (most reliable for copy/cut)
      let selectedText: string | undefined = undefined;
      if (event.clipboardData) {
        try {
          selectedText = event.clipboardData.getData('text/plain');
        } catch (e) {
          // This can happen in some edge cases or if data type isn't available
          // console.warn('Could not getData from clipboardData:', e);
        }
      }

      // Fallback to window.getSelection() if clipboardData is empty or unavailable
      // This is crucial because sometimes clipboardData might be empty on 'copy' event
      // until the default action completes. However, for our purpose of logging what
      // *was* selected, window.getSelection() is good.
      if (!selectedText || selectedText.trim().length === 0) {
        const selection = window.getSelection();
        if (selection)
          selectedText = selection.toString();
      }

      if (selectedText && selectedText.trim().length > 0) {
        // Only add if the target is editable or there's a general text selection
        // This avoids capturing copies from non-text elements unless text was explicitly selected.
        if (isTargetTypicallyEditable(targetElement) || (window.getSelection()?.toString()?.trim()?.length ?? 0) > 0)
          scratchClipActions().addSnippet(selectedText, targetElement instanceof HTMLElement ? targetElement : undefined);
        // else console.log('ScratchClip: Ignoring copy from non-editable or non-text-selection target.');
      }

      // DO NOT call event.preventDefault() or event.stopPropagation().
      // The native copy/cut operation should proceed as usual.
    };

    // capture both the copy and cut events
    document.addEventListener('copy', handleClipboardAction);
    document.addEventListener('cut', handleClipboardAction);

    return () => {
      document.removeEventListener('copy', handleClipboardAction);
      document.removeEventListener('cut', handleClipboardAction);
    };
  }, [enabled]);
}
