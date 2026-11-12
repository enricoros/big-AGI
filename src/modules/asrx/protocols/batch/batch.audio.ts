/**
 * Audio container helpers shared by the multipart batch adapters: the recorder reports a MIME type
 * (with codec parameters, e.g. 'audio/webm;codecs=opus'), the vendors want a bare type and a filename.
 */


/** The MIME type without parameters, with the common aliases folded onto the canonical names vendors list. */
export function asrxAudioBareMimeType(mimeType: string): string {
  const bare = mimeType.split(';')[0].trim().toLowerCase();
  switch (bare) {
    case 'audio/x-wav':
    case 'audio/wave':
    case 'audio/vnd.wave':
      return 'audio/wav';
    case 'audio/mp3':
      return 'audio/mpeg';
    case 'audio/x-m4a':
    case 'audio/m4a':
      return 'audio/mp4';
    default:
      return bare || 'application/octet-stream';
  }
}

/** A filename with a useful extension for the MIME type - vendors infer the container from it. */
export function asrxAudioFileName(mimeType: string): string {
  if (mimeType.includes('webm')) return 'audio.webm';
  if (mimeType.includes('ogg')) return 'audio.ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'audio.m4a';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'audio.mp3';
  if (mimeType.includes('wav')) return 'audio.wav';
  if (mimeType.includes('flac')) return 'audio.flac';
  if (mimeType.includes('aac')) return 'audio.aac';
  return 'audio';
}
