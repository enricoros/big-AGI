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