import * as z from 'zod/v4';

import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';
import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { ListModelsResponse_schema } from '../llm.server.types';
import { listModelsRunDispatch } from '../listModels.dispatch';

import { geminiAccess, geminiAccessSchema } from './gemini.access';


// Mappers

// async function geminiGET<TOut extends object>(access: GeminiAccessSchema, modelRefId: string | null, apiPath: string /*, signal?: AbortSignal*/, useV1Alpha: boolean): Promise<TOut> {
//   const { headers, url } = geminiAccess(access, modelRefId, apiPath, useV1Alpha);
//   return await fetchJsonOrTRPCThrow<TOut>({ url, headers, name: 'Gemini' });
// }

// async function geminiPOST<TOut extends object, TPostBody extends object>(access: GeminiAccessSchema, modelRefId: string | null, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/, useV1Alpha: boolean): Promise<TOut> {
//   const { headers, url } = geminiAccess(access, modelRefId, apiPath, useV1Alpha);
//   return await fetchJsonOrTRPCThrow<TOut, TPostBody>({ url, method: 'POST', headers, body, name: 'Gemini' });
// }


// Router Input/Output Schemas

const accessOnlySchema = z.object({
  access: geminiAccessSchema,
});


// SSRF guard: accept only the canonical `files/{id}` name; the download/metadata URLs are reconstructed
// server-side (never fetch a client-supplied absolute URL with our key).
const geminiFileNameSchema = z.string().regex(/^files\/[a-z0-9]+$/, 'invalid Gemini file name');

// Files API (files.get) response - `sizeBytes` comes as a numeric string; `state` is PROCESSING|ACTIVE|FAILED.
const GeminiFileGetResponse_schema = z.looseObject({
  name: z.string(),
  mimeType: z.string().optional(),
  sizeBytes: z.union([z.string(), z.number()]).optional(),
  createTime: z.string().optional(),
  expirationTime: z.string().optional(),
  state: z.string().optional(),
});

// Normalized metadata we return to the client chip.
const GeminiFileMetadata_schema = z.object({
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  createTime: z.string(),
  expirationTime: z.string(),
  state: z.string(),
});


/**
 * See https://github.com/google/generative-ai-js/tree/main/packages/main/src for
 * the official Google implementation.
 */
export const llmGeminiRouter = createTRPCRouter({

  /* [Gemini] models.list = /v1beta/models */
  listModels: edgeProcedure
    .input(accessOnlySchema)
    .output(ListModelsResponse_schema)
    .query(async ({ input, signal }) => {

      const models = await listModelsRunDispatch(input.access, signal);

      return { models };
    }),

  /* [Gemini] Files API - download bytes. The media URL rejects unregistered callers (403), so we proxy
     it through the key. Used by the hosted-video chip to download or re-play an Omni artifact within its 48h TTL. */
  fileApiDownload: edgeProcedure
    .input(z.object({
      access: geminiAccessSchema,
      fileName: geminiFileNameSchema,
    }))
    .query(async ({ input: { access, fileName } }) => {
      const { headers, url } = geminiAccess(access, null, `/v1beta/${fileName}:download?alt=media`, false);
      const response = await fetchResponseOrTRPCThrow({ url, headers, name: 'Gemini' });

      // Guard against excessively large files (32 MB limit - generated clips are small; protects the edge fn)
      const MAX_FILE_BYTES = 32 * 1024 * 1024;
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_FILE_BYTES)
        throw new Error(`File too large to download (${(contentLength / 1024 / 1024).toFixed(1)} MB, limit ${MAX_FILE_BYTES / 1024 / 1024} MB)`);

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_FILE_BYTES)
        throw new Error(`File too large to download (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB, limit ${MAX_FILE_BYTES / 1024 / 1024} MB)`);

      return {
        base64Data: Buffer.from(arrayBuffer).toString('base64'),
        mimeType: response.headers.get('content-type') || 'application/octet-stream',
      };
    }),

  /* [Gemini] Files API - metadata (files.get): size, mime, expiry (createTime + 48h), state. A 404 means the
     file has expired/been deleted - the chip surfaces that as 'no longer available'. */
  fileApiGetMetadata: edgeProcedure
    .input(z.object({
      access: geminiAccessSchema,
      fileName: geminiFileNameSchema,
    }))
    .output(GeminiFileMetadata_schema)
    .query(async ({ input: { access, fileName } }) => {
      const { headers, url } = geminiAccess(access, null, `/v1beta/${fileName}`, false);
      const raw = await fetchJsonOrTRPCThrow<object>({ url, headers, name: 'Gemini' });
      const meta = GeminiFileGetResponse_schema.parse(raw);
      return {
        name: meta.name,
        mimeType: meta.mimeType || '',
        sizeBytes: typeof meta.sizeBytes === 'string' ? (parseInt(meta.sizeBytes, 10) || 0) : (meta.sizeBytes ?? 0),
        createTime: meta.createTime || '',
        expirationTime: meta.expirationTime || '',
        state: meta.state || '',
      };
    }),

  /* [Gemini] Files API - delete a file from Google now (before its 48h TTL): DELETE /v1beta/files/{id} -> 200.
     Used when the user removes a generated-video chip, so the artifact doesn't linger server-side. */
  fileApiDelete: edgeProcedure
    .input(z.object({
      access: geminiAccessSchema,
      fileName: geminiFileNameSchema,
    }))
    .mutation(async ({ input: { access, fileName } }) => {
      const { headers, url } = geminiAccess(access, null, `/v1beta/${fileName}`, false);
      await fetchResponseOrTRPCThrow({ url, method: 'DELETE', headers, name: 'Gemini' });
      return { deleted: true };
    }),

});
