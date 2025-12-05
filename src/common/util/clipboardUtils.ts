import { addSnackbar } from '../components/snackbar/useSnackbarsStore';
import { Is, isBrowser } from './pwaUtils';


/** Strip theme-dependent colors from an HTML element tree (in-place) */
export function stripHtmlColors(element: HTMLElement) {
  element.querySelectorAll('*').forEach((el) => {
    if (el instanceof HTMLElement)
      ['color', 'background', 'background-color'].forEach(p => el.style.removeProperty(p));
  });
}

/**
 * Copy HTML to clipboard with theme-dependent colors stripped (keeps formatting like font sizes).
 * Falls back to plain text if HTML clipboard write fails.
 */
export function copyToClipboardHtmlMinusColors(html: string, plainText: string, typeLabel: string) {
  if (!isBrowser) return;

  const div = document.createElement('div');
  div.innerHTML = html;
  stripHtmlColors(div);

  const blob = new Blob([div.innerHTML], { type: 'text/html' });
  const textBlob = new Blob([plainText], { type: 'text/plain' });

  navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })])
    .then(() => addSnackbar({ key: 'copy-to-clipboard', message: `${typeLabel} copied to clipboard`, type: 'success', closeButton: false, overrides: { autoHideDuration: 2000 } }))
    .catch(() => copyToClipboard(plainText, typeLabel)); // fallback to plain text
}


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