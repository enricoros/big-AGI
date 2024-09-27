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
      console.error('Failed to copy message: ', err);
    });
}

export function copyBlobToClipboard(blob: Blob, typeLabel: string) {
  if (!isBrowser)
    return;
  if (!navigator.clipboard || !navigator.clipboard.write) {
    alert('Clipboard access is blocked or not supported in this browser.');
    return;
  }
  // Create a ClipboardItem with the Blob
  const clipboardItem = new ClipboardItem({ [blob.type]: blob });
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
      console.error('Failed to copy blob to clipboard: ', err);
      alert('Failed to copy image to clipboard. Please try again.');
    });
}

// NOTE: this could be implemented in a platform-agnostic manner with !!.read, but we call it out here for clarity
export const supportsClipboardRead = !Is.Browser.Firefox;

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