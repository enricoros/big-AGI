import { isBrowser, isFirefox } from './pwaUtils';

export function copyToClipboard(text: string) {
  if (isBrowser)
    window.navigator.clipboard.writeText(text)
      .then(() => console.log('Message copied to clipboard'))
      .catch((err) => console.error('Failed to copy message: ', err));
}

// NOTE: this could be implemented in a platform-agnostic manner with !!.read, but we call it out here for clarity
export const supportsClipboardRead = !isFirefox;

export async function getClipboardItems(): Promise<ClipboardItem[]> {
  if (!isBrowser || !window.navigator.clipboard?.read)
    return [];
  return await window.navigator.clipboard.read();
}