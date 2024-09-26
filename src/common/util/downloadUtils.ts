/**
 * Triggers a file download given a URL and filename.
 * @param url - The URL of the file to download:
 * @param filename - The desired filename for the downloaded file.
 */
export function downloadToFile(url: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'download';
  document.body.appendChild(anchor); // Ensure visibility in the DOM for Firefox
  anchor.click();
  document.body.removeChild(anchor); // Clean up
}

/**
 * Downloads a file from a Blob object.
 * @param blob - The Blob object containing the file data.
 * @param filename - The desired filename for the downloaded file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  downloadToFile(url, filename);
  URL.revokeObjectURL(url); // Clean up the Blob URL
}

//
// /**
//  * Downloads text content as a file.
//  * @param content - The text content to download.
//  * @param filename - The desired filename for the downloaded file.
//  */
// export function downloadText(content: string, filename: string): void {
//   const blob = new Blob([content], { type: 'text/plain' });
//   downloadBlob(blob, filename);
// }
//
// /**
//  * Downloads a JSON object as a file.
//  * @param data - The JSON object to download.
//  * @param filename - The desired filename for the downloaded file.
//  */
// export function downloadJSON(data: any, filename: string): void {
//   const jsonStr = JSON.stringify(data, null, 2);
//   const blob = new Blob([jsonStr], { type: 'application/json' });
//   downloadBlob(blob, filename);
// }
//
