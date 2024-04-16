import { addSnackbar } from '../components/useSnackbarsStore';
import { isBrowser, isFirefox } from './pwaUtils';

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
          autoHideDuration: 1400,
        },
      });
    })
    .catch((err) => {
      console.error('Failed to copy message: ', err);
    });
}

// NOTE: this could be implemented in a platform-agnostic manner with !!.read, but we call it out here for clarity
export const supportsClipboardRead = !isFirefox;

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