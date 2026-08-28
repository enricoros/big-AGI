import { z } from 'zod';

import { apiAsync } from '~/common/util/trpc.client';
import { convert_Base64_To_UInt8Array } from '~/common/util/blobUtils';
import { frontendSideFetch } from '~/common/util/clientFetchers';

// import client-side the server parts
import { geminiAccess, GeminiAccessSchema } from '../../server/gemini/gemini.access';


/**
 * Client-side access to Gemini Files-API artifacts (Omni videos, ASRx audio).
 *
 * Two transports, chosen by `access.clientSideFetch`:
 * - CSF ON: browser -> Google directly, via the isomorphic `geminiAccess` (`?key=` form, multi-key, host
 *   fixup - parity with the server route). No custom headers: GETs are preflight-free, DELETE's preflight
 *   is permitted. CORS verified 2026-07-05 (download/metadata/delete), 2026-08-28 (upload).
 * - CSF OFF: key-proxied tRPC routes. Upload only proxies the tiny START (returning a key-free bearer
 *   upload URL) - the bytes always go browser -> Google directly, never through the edge fns.
 */

export interface GeminiFileMetadata {
  name: string;
  mimeType: string;
  sizeBytes: number;
  createTime: string;
  expirationTime: string;
  state: string;
}

// Error carrying the HTTP status, so the chip's 'expired -> gone' (404) detection works on the CSF path too.
class GeminiFileHttpError extends Error {
  constructor(readonly httpStatus: number, message: string) {
    super(message);
    this.name = 'GeminiFileHttpError';
  }
}

function _normalizeMetadata(raw: any): GeminiFileMetadata {
  return {
    name: raw?.name || '',
    mimeType: raw?.mimeType || '',
    sizeBytes: typeof raw?.sizeBytes === 'string' ? (parseInt(raw.sizeBytes, 10) || 0) : (raw?.sizeBytes ?? 0),
    createTime: raw?.createTime || '',
    expirationTime: raw?.expirationTime || '',
    state: raw?.state || '',
  };
}

export async function geminiFileGetMetadata(access: GeminiAccessSchema, fileName: string): Promise<GeminiFileMetadata> {
  if (access.clientSideFetch) {
    const { url } = geminiAccess(access, null, `/v1beta/${fileName}`, false);
    const response = await frontendSideFetch(url);
    if (!response.ok) throw new GeminiFileHttpError(response.status, `Gemini file metadata failed (${response.status})`);
    return _normalizeMetadata(await response.json());
  }
  return apiAsync.llmGemini.fileApiGetMetadata.query({ access, fileName });
}

export async function geminiFileDownloadBlob(access: GeminiAccessSchema, fileName: string): Promise<Blob> {
  if (access.clientSideFetch) {
    const { url } = geminiAccess(access, null, `/v1beta/${fileName}:download?alt=media`, false);
    const response = await frontendSideFetch(url);
    if (!response.ok) throw new GeminiFileHttpError(response.status, `Gemini file download failed (${response.status})`);
    return await response.blob();
  }
  const { base64Data, mimeType } = await apiAsync.llmGemini.fileApiDownload.query({ access, fileName });
  return new Blob([convert_Base64_To_UInt8Array(base64Data, 'gemini-file-download')], { type: mimeType });
}

export async function geminiFileDelete(access: GeminiAccessSchema, fileName: string): Promise<void> {
  if (access.clientSideFetch) {
    const { url } = geminiAccess(access, null, `/v1beta/${fileName}`, false);
    const response = await frontendSideFetch(url, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) throw new GeminiFileHttpError(response.status, `Gemini file delete failed (${response.status})`);
    return;
  }
  await apiAsync.llmGemini.fileApiDelete.mutate({ access, fileName });
}

// --- Upload ---

// only the fields we read; unknown keys ignored
const GeminiWire_FileUpload_Response_schema = z.object({
  file: z.object({
    name: z.string(),     // 'files/abc123' - the delete handle
    uri: z.string(),      // absolute - referenced verbatim by callers
    state: z.string().optional(),
  }),
});

/**
 * Resumable upload - dual like its siblings, but the BYTES always go browser -> Google directly:
 * the upload URL is a bearer capability (key-free on the tRPC-started path), so MBs never traverse
 * the edge fns. Verified 2026-08-28: `X-Goog-Upload-URL` is CORS-exposed, the `X-Goog-Upload-*`
 * headers pass preflight, and the session's CORS grant is bound to the start request's Origin.
 * Audio lands ACTIVE immediately (42.9MB, 85.8MB; API cap 2GB, 48h retention); video may
 * PROCESS - a not-ACTIVE file is polled (~30s) first.
 */
export async function geminiFileUpload(access: GeminiAccessSchema, bytes: Uint8Array, mimeType: string, displayName: string, signal?: AbortSignal): Promise<{ name: string; uri: string }> {

  // 1. start -> bearer upload URL (CSF: browser-direct; else: tRPC keeps the key server-side)
  let uploadUrl: string;
  if (access.clientSideFetch) {
    const { headers: startHeaders, url: startUrl } = geminiAccess(access, null, '/upload/v1beta/files', false);
    const startResponse = await frontendSideFetch(startUrl, {
      method: 'POST',
      headers: {
        ...startHeaders,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
        'X-Goog-Upload-Header-Content-Type': mimeType,
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
      signal,
    });
    if (!startResponse.ok) throw new GeminiFileHttpError(startResponse.status, `Gemini upload start failed (${startResponse.status})`);
    const csfUploadUrl = startResponse.headers.get('x-goog-upload-url');
    if (!csfUploadUrl) throw new Error('Gemini upload start returned no upload URL');
    uploadUrl = csfUploadUrl;
  } else {
    ({ uploadUrl } = await apiAsync.llmGemini.fileApiUploadStart.mutate({
      access, sizeBytes: bytes.byteLength, mimeType, displayName,
      ...(typeof window !== 'undefined' && window.location?.origin ? { origin: window.location.origin } : {}),
    }));
  }

  // 2. bytes: single-shot upload + finalize, raw body
  const uploadResponse = await frontendSideFetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
    },
    body: bytes as BodyInit, // Uint8Array<ArrayBufferLike> vs the lib's ArrayBufferView<ArrayBuffer>
    signal,
  });
  if (!uploadResponse.ok)
    throw new GeminiFileHttpError(uploadResponse.status, `Gemini upload failed (${uploadResponse.status})`);
  const uploadValidated = GeminiWire_FileUpload_Response_schema.safeParse(await uploadResponse.json().catch(() => null));
  if (!uploadValidated.success)
    throw new Error('Gemini upload returned an unexpected response');
  const { name, uri, state } = uploadValidated.data.file;

  // 3. PROCESSING wait - check first, then sleep
  if (state === 'PROCESSING') {
    for (let attempt = 0; attempt < 15; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const metadata = await geminiFileGetMetadata(access, name).catch(() => null); // same access -> same key sees the file
      if (metadata?.state === 'ACTIVE') return { name, uri };
      if (metadata?.state === 'FAILED') throw new Error('Gemini file processing failed');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Gemini file processing timed out');
  }

  return { name, uri };
}


// 404 detection unified across CSF (GeminiFileHttpError.httpStatus) and tRPC (error.data.httpStatus) error shapes.
export function geminiFileErrorIsGone(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as any).httpStatus === 404) return true;
  const data = (error as any).data;
  return !!data && (data.httpStatus === 404 || data.aixFHttpStatus === 404);
}
