import { isBrowser } from './pwaUtils';

export function copyToClipboard(text: string) {
  if (isBrowser)
    window.navigator.clipboard.writeText(text)
      .then(() => console.log('Message copied to clipboard'))
      .catch((err) => console.error('Failed to copy message: ', err));
}