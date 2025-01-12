import type { HTTPResponse } from 'puppeteer-core';


/**
 * When Puppeteer downloads a file instead of a web page, we run it through allowlists before deciding
 * whether to process it or not. This is to reduce the likelihood of downloading malicious files.
 * However the end responsibility lies with the user, as both the server and the client won't validate
 * further.
 */
const SERVER_SUPPORTED_DOWNLOADS = {
  document: {
    mimetypes: new Set([
      // PDF
      'application/pdf',
      'application/x-pdf',
      'application/acrobat',
      // Word
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]),
    maxSizeMB: 20,
  },
  text: {
    mimetypes: new Set([
      // Basic Text
      'text/plain',
      'text/markdown',
      'text/html',
      'text/rtf',
      'application/rtf',
      // Code - JavaScript/TypeScript
      'text/javascript',
      'application/javascript',
      'text/typescript',
      'application/typescript',
      // Web
      'text/css',
      'text/csv',
      'text/xml',
      'application/json',
      // Programming Languages
      'text/x-python',
      'text/x-java',
      'text/x-c',
      'text/x-cpp',
      'text/x-csharp',
      'text/x-ruby',
      'text/x-go',
      'text/x-rust',
    ]),
    maxSizeMB: 2,
  },
  image: {
    mimetypes: new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ]),
    maxSizeMB: 10,
  },
} as const;


function _getMimeCategory(mimeType: string): keyof typeof SERVER_SUPPORTED_DOWNLOADS | null {
  const cleanMime = mimeType.split(';')[0].toLowerCase();
  return Object.entries(SERVER_SUPPORTED_DOWNLOADS).find(([_, { mimetypes }]) => {
    return mimetypes.has(cleanMime);
  })?.[0] as keyof typeof SERVER_SUPPORTED_DOWNLOADS | null;
}

function _sanitizeFilename(filename: string): string {
  // Remove or replace potentially problematic characters
  return filename
    .replace(/[<>:"/\\|?*]/g, '_') // Replace Windows-unsafe characters
    .replace(/\.\./g, '_')         // Prevent directory traversal
    .replace(/^\./, '_')          // No leading dots
    .replace(/\s+/g, '_')         // Replace spaces with underscores
    .slice(0, 255);               // Maximum length for most filesystems
}


/**
 * SECURITY NOTE - while we validate MIME types and sizes, the server-provided MIME type
 * is still trusted for initial categorization.
 */
export async function workerPuppeteerDownloadFileOrThrow(response: HTTPResponse): Promise<{
  file: {
    mimeType: string;
    data: string;
    size: number;
    filename?: string;
    category?: keyof typeof SERVER_SUPPORTED_DOWNLOADS;
  }
}> {

  // validate content-type
  const headers = response.headers();
  const mimeType = headers['content-type']?.split(';')[0].toLowerCase() || '';
  if (!mimeType)
    throw new Error('No content-type header received');

  const category = _getMimeCategory(mimeType);
  if (!category)
    throw new Error(`Unsupported file type: ${mimeType}`);

  // validate size
  // NOTE: disabled due to real-world server returning chunked sizes, etc.
  // const size = parseInt(headers['content-length'] || '0');
  // const maxSize = SERVER_SUPPORTED_DOWNLOADS[category].maxSizeMB * 1024 * 1024;
  // if (size > maxSize)
  //   throw new Error('File size exceeds the limit. Please download it manually and attach it as file.');

  // get the content
  const buffer = await response.buffer();
  if (!buffer || buffer.length === 0)
    throw new Error('No content received');

  // validate actual size against our limits
  const maxSize = SERVER_SUPPORTED_DOWNLOADS[category].maxSizeMB * 1024 * 1024;
  if (buffer.length > maxSize)
    throw new Error(`File exceeds the size limit for download (${SERVER_SUPPORTED_DOWNLOADS[category].maxSizeMB}MB). Please attach it manually.`);

  // heuristic: guess filename if possible
  let filename: string | undefined;
  const contentDisposition = headers['content-disposition'];
  if (contentDisposition) {
    const filenameMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
    if (filenameMatch) {
      const rawFilename = filenameMatch[1].replace(/['"]/g, '');
      filename = _sanitizeFilename(rawFilename);
    }
  }

  return {
    file: {
      mimeType,
      data: buffer.toString('base64'),
      size: buffer.length,
      ...(filename && { filename }),
      category,
    },
  };
}
