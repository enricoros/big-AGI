import { copyToClipboard } from '~/common/util/clipboardUtils';


export function isGoogleColabSupported(language: string | null) {
  return !!language && language === 'python';
}


export function openInGoogleColab(code: string) {
  // Copy the code to the clipboard
  copyToClipboard(code, 'Python code');

  // Open a new Google Colab notebook
  window.open('https://colab.research.google.com/#create=true', '_blank');
}
