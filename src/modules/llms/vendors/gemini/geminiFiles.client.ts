import { apiAsync } from '~/common/util/trpc.client';
import { convert_Base64_To_UInt8Array } from '~/common/util/blobUtils';

// import client-side the server parts
import { geminiAccess, GeminiAccessSchema } from '../../server/gemini/gemini.access';


/**
 * Client-side access to a Gemini Files-API artifact (e.g. an Omni-generated video), with a CSF fast-path.
 *
 * Two transports, chosen by `access.clientSideFetch`:
 * - CSF ON: the browser fetches Google directly, so the API key stays client-side and never transits our server
 *   (and we don't proxy MBs through the edge fn). Google's Files endpoints reflect the request Origin - CORS verified
 *   2026-07-05: download/metadata/delete all return `Access-Control-Allow-Origin`. We use `geminiAccess`'s `?key=` URL
 *   form and send NO custom headers, so GETs are "simple" requests (no preflight) and the DELETE preflight is
 *   permitted (Allow-Methods includes DELETE). `geminiAccess` is isomorphic and handles host-fixup + multi-key, so
 *   this stays at parity with the server route.
 * - CSF OFF: the existing key-proxied tRPC routes (our server holds the key).
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
  if (!access.clientSideFetch)
    return apiAsync.llmGemini.fileApiGetMetadata.query({ access, fileName });
  const { url } = geminiAccess(access, null, `/v1beta/${fileName}`, false);
  const response = await fetch(url); // ?key= is in the URL; no custom headers -> simple GET (no CORS preflight)
  if (!response.ok) throw new GeminiFileHttpError(response.status, `Gemini file metadata failed (${response.status})`);
  return _normalizeMetadata(await response.json());
}

export async function geminiFileDownloadBlob(access: GeminiAccessSchema, fileName: string): Promise<Blob> {
  if (!access.clientSideFetch) {
    const { base64Data, mimeType } = await apiAsync.llmGemini.fileApiDownload.query({ access, fileName });
    return new Blob([convert_Base64_To_UInt8Array(base64Data, 'gemini-file-download')], { type: mimeType });
  }
  const { url } = geminiAccess(access, null, `/v1beta/${fileName}:download?alt=media`, false);
  const response = await fetch(url);
  if (!response.ok) throw new GeminiFileHttpError(response.status, `Gemini file download failed (${response.status})`);
  return await response.blob();
}

export async function geminiFileDelete(access: GeminiAccessSchema, fileName: string): Promise<void> {
  if (!access.clientSideFetch) {
    await apiAsync.llmGemini.fileApiDelete.mutate({ access, fileName });
    return;
  }
  const { url } = geminiAccess(access, null, `/v1beta/${fileName}`, false);
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) throw new GeminiFileHttpError(response.status, `Gemini file delete failed (${response.status})`);
}

// 404 detection unified across CSF (GeminiFileHttpError.httpStatus) and tRPC (error.data.httpStatus) error shapes.
export function geminiFileErrorIsGone(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as any).httpStatus === 404) return true;
  const data = (error as any).data;
  return !!data && (data.httpStatus === 404 || data.aixFHttpStatus === 404);
}
