/**
 * Attachment Cloud Files
 *
 * For future refresh capability, the output fragments should preserve:
 * - provider, fileId: to identify the file
 * - mimeType: the original cloud MIME type
 * - the converter used (stored in outputsHeuristic.actualConverterId)
 *
 * Google Workspace files (Docs, Sheets, Slides) are auto-exported during
 * input loading to standard formats (HTML, CSV, PDF) and then processed
 * by standard converters.
 */

import type { AttachmentCloudProviderId } from './attachment.types';


// Error handling

export class CloudFetchError extends Error {
  constructor(public readonly code: _CloudFetchErrorCode, public readonly details?: string) {
    super(`Cloud fetch error: ${code}${details ? ` - ${details}` : ''}`);
    this.name = 'CloudFetchError';
  }
}

type _CloudFetchErrorCode = 'AUTH_EXPIRED' | 'NOT_FOUND' | 'FORBIDDEN' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'NOT_IMPLEMENTED' | 'FETCH_FAILED';


// Utility functions


/**
 * Google Workspace files can't be downloaded directly - they must be exported.
 * We prioritize AI-friendly formats (text > binary).
 *
 * Docs:     md, docx, pdf, txt, rtf, odt, epub, html.zip
 * Sheets:   xlsx, pdf, csv (1st sheet), tsv, ods
 * Slides:   pptx, pdf, txt, png/jpg/svg (1st slide)
 * Drawings: png, pdf, jpg, svg
 *
 * Regular files: we'll return no conversion
 *
 * @see https://developers.google.com/workspace/drive/api/guides/ref-export-formats
 */
const _GOOGLE_WORKSPACE_EXPORT: Record<string, { mimeType: string; ext: string, converter: string }> = {
  'application/vnd.google-apps.document': { mimeType: 'text/markdown', ext: '.md', converter: 'Doc -> ' },
  'application/vnd.google-apps.spreadsheet': { mimeType: 'text/csv', ext: '.csv', converter: 'Sheet -> ' },
  'application/vnd.google-apps.presentation': { mimeType: 'application/pdf', ext: '.pdf', converter: 'Slides -> ' },
  'application/vnd.google-apps.drawing': { mimeType: 'image/svg+xml', ext: '.svg', converter: 'Drawing -> ' },
};

export function attachmentCloudGoogleWorkspaceExportMIME(cloudMimeType: string): string | undefined {
  return _GOOGLE_WORKSPACE_EXPORT[cloudMimeType]?.mimeType;
}

export function attachmentCloudConverterPrefix(cloudMimeType: string): string {
  return _GOOGLE_WORKSPACE_EXPORT[cloudMimeType]?.converter || 'Drive -> ';
}


// Fetcher

/**
 * Fetch a file from a cloud provider.
 *
 * @param provider - The cloud provider ID
 * @param fileId - The file ID in the provider's system
 * @param accessToken - OAuth access token
 * @param exportMimeType - For native formats (Docs/Sheets), the export format
 * @returns The file content as a Blob
 */
export async function attachmentCloudFetchFile(
  provider: AttachmentCloudProviderId,
  fileId: string,
  accessToken: string,
  exportMimeType?: string,
): Promise<Blob> {
  switch (provider) {
    case 'gdrive':
      return _fetchGoogleDriveFile(fileId, accessToken, exportMimeType);

    case 'onedrive':
    case 'dropbox':
      throw new CloudFetchError('NOT_IMPLEMENTED', `${provider} support coming soon`);

    default:
      throw new CloudFetchError('NOT_IMPLEMENTED', `Unknown provider: ${provider}`);
  }
}


/**
 * Google Drive API - Fetch file content
 * https://developers.google.com/drive/api/reference/rest/v3/files/get
 * https://developers.google.com/drive/api/reference/rest/v3/files/export
 */
async function _fetchGoogleDriveFile(
  fileId: string,
  accessToken: string,
  exportMimeType?: string,
): Promise<Blob> {

  // for native Google Workspace files, use export endpoint
  const url = exportMimeType
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportMimeType)}`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  }).catch((error) => {
    console.log('[DEV] Network error while fetching Google Drive file:', { error });
    throw new CloudFetchError('NETWORK_ERROR', error?.message || String(error));
  });

  // NOTE: we shall consider moving this to use fetchResponseOrTRPCThrow instead of this custom small impl..
  if (!response.ok) {
    const errorCode = _mapHttpStatusToErrorCode(response.status);
    let details = `${response.status}: ${response.statusText}`;
    try {
      const errorBody = await response.text();
      if (errorBody) details += ` - ${errorBody.slice(0, 200)}`;
    } catch { /* ignore */
    }
    throw new CloudFetchError(errorCode, details);
  }

  return response.blob();
}


function _mapHttpStatusToErrorCode(status: number): _CloudFetchErrorCode {
  switch (status) {
    case 401:
      return 'AUTH_EXPIRED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'FETCH_FAILED';
  }
}
