import type { ClipboardEvent as ReactClipboardEvent } from 'react';

import { addSnackbar } from '../components/snackbar/useSnackbarsStore';
import { Is, isBrowser } from './pwaUtils';


export function copyToClipboard(text: string, typeLabel: string) {
  if (!isBrowser)
    return;
  if (!window.navigator.clipboard?.writeText) {
    alert('Clipboard access is blocked. Please enable it in your browser settings.');
    return;
  }
  window.navigator.clipboard.writeText(text)
    .then(() => {
      addSnackbar({
        key: 'copy-to-clipboard',
        message: `${typeLabel} copied to clipboard`,
        type: 'success',
        closeButton: false,
        overrides: {
          autoHideDuration: 2000,
        },
      });
    })
    .catch((err) => {
      alert(`Failed to message to clipboard${err?.name ? ' (' + err.name + ')' : ''}.\n\n${err?.message || 'Unknown error, likely a permission issue.'}`);
    });
}

export function copyBlobPromiseToClipboard(mimeType: string, blobPromise: Promise<Blob>, typeLabel: string) {
  if (!isBrowser)
    return;
  if (!navigator.clipboard || !navigator.clipboard.write) {
    alert('Clipboard access is blocked or not supported in this browser.');
    return;
  }
  // Create a ClipboardItem with the Blob
  const clipboardItem = new ClipboardItem({ [mimeType]: blobPromise });

  // Write the ClipboardItem to the clipboard
  navigator.clipboard.write([clipboardItem])
    .then(() => {
      addSnackbar({
        key: 'copy-blob-to-clipboard',
        message: `${typeLabel} copied to clipboard`,
        type: 'success',
        closeButton: false,
        overrides: {
          autoHideDuration: 2000,
        },
      });
    })
    .catch((err) => {
      const [media, type] = mimeType.split('/');
      alert(`Failed to copy ${type?.toUpperCase()} ${media} to clipboard${err?.name ? ' (' + err.name + ')' : ''}.\n\n${err?.message || 'Unknown error, likely a permission issue.'}`);
    });
}

export function supportsClipboardRead() {
  return !Is.Browser.Firefox;
}

export async function getClipboardItems(): Promise<ClipboardItem[] | null> {
  if (!isBrowser || !window.navigator.clipboard?.read)
    return [];
  try {
    return await window.navigator.clipboard.read();
  } catch (error: any) {
    console.warn('Failed to read clipboard: ', error);
    return null;
  }
}


// --- HTML copy (from DOM Elements / Selection) with cleaning ---

/**
 * Copy selection (if within container) or entire container content to clipboard.
 * Strips theme colors and no-copy elements. Shows snackbar notification.
 */
export function clipboardCopyDOMSelectionOrFallback(containerElement: HTMLElement | null, fallbackText: string, typeLabel: string) {
  if (!isBrowser) return;

  const selection = window.getSelection();
  const hasSelectionInContainer = selection && !selection.isCollapsed && containerElement?.contains(selection.anchorNode);

  // Clone content: selection or full container
  const div = document.createElement('div');
  if (hasSelectionInContainer) {
    div.appendChild(selection.getRangeAt(0).cloneContents());
  } else if (containerElement) {
    div.innerHTML = containerElement.innerHTML;
  } else {
    copyToClipboard(fallbackText, typeLabel);
    return;
  }

  _cleanElementForCopy(div);
  const cleanedHtml = div.innerHTML;
  const cleanedText = _getInnerTextFromFloatingElement(div, fallbackText);

  // Write both HTML and plain text to clipboard
  const htmlBlob = new Blob([cleanedHtml], { type: 'text/html' });
  const textBlob = new Blob([cleanedText], { type: 'text/plain' });

  navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })])
    .then(() => addSnackbar({ key: 'copy-to-clipboard', message: `${hasSelectionInContainer ? 'Selection' : typeLabel} copied to clipboard`, type: 'success', closeButton: false, overrides: { autoHideDuration: 2000 } }))
    .catch(() => copyToClipboard(cleanedText, typeLabel));
}

/**
 * Intercept copy event (Ctrl+C) to clean HTML before copying.
 * Call this from onCopy handlers. Returns true if handled.
 */
export function clipboardInterceptCtrlCForCleanup(event: ReactClipboardEvent): boolean {
  if (!isBrowser) return false;

  // require a valid selection
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !event.clipboardData) return false;

  // clone selection content and clean it
  const div = document.createElement('div');
  div.appendChild(selection.getRangeAt(0).cloneContents());
  _cleanElementForCopy(div);

  // get formatted text (innerText respects block elements for line breaks)
  const cleanedHtml = div.innerHTML;
  const cleanedText = _getInnerTextFromFloatingElement(div, selection.toString());

  // set cleaned data to clipboard
  event.clipboardData?.setData('text/html', cleanedHtml);
  event.clipboardData?.setData('text/plain', cleanedText);
  event.preventDefault();
  return true;
}


function _cleanElementForCopy(element: HTMLElement) {
  // remove elements marked with data-agi-no-copy (buttons, reasoning, citations, etc.)
  element.querySelectorAll('[data-agi-no-copy]').forEach((el) => el.remove());

  // clean all elements
  [element, ...element.querySelectorAll('*')].forEach((el) => {
    if (!(el instanceof HTMLElement)) return;

    // strip theme-dependent colors, but keeps formatting like font sizes
    ['color', 'background', 'background-color'].forEach(p => el.style.removeProperty(p));

    // preserve whitespace formatting for code elements (newlines would collapse otherwise)
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'pre' || tagName === 'code')
      el.style.whiteSpace = 'pre-wrap';

    // remove framework/accessibility cruft
    el.removeAttribute('class');
    el.removeAttribute('tabindex');
    el.removeAttribute('role');
    [...el.attributes].filter(a => a.name.startsWith('aria-')).forEach(a => el.removeAttribute(a.name));
  });

  // remove empty divs (wrapper cruft)
  element.querySelectorAll('div:empty').forEach((el) => el.remove());
}

/** Get properly formatted text from element (with line breaks for block elements) */
function _getInnerTextFromFloatingElement(element: HTMLElement, fallback: string): string {
  // innerText requires element to be in DOM to respect CSS layout
  // Note: can't use visibility:hidden as innerText won't return text from hidden elements
  // Note: white-space:pre-wrap preserves newlines in code (partial selections may not include <code> wrapper)
  element.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;white-space:pre-wrap';
  document.body.appendChild(element);
  try {
    return element.innerText || fallback;
  } finally {
    element.remove();
  }
}
