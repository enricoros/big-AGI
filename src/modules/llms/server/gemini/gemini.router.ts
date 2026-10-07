import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';
import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { GeminiWire_API_Generate_Content, GeminiWire_ContentParts } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';
import { geminiSafetySettings } from '~/modules/aix/server/dispatch/chatGenerate/adapters/gemini.generateContent';
import { heartbeatsWhileAwaiting } from '~/modules/aix/server/dispatch/heartbeatsWhileAwaiting';
import { getImageInformationFromBytes, type T2ICreateImageAsyncStreamOp } from '~/modules/t2i/t2i.server';
import { T2I_CONTEXT_NAMES } from '~/modules/t2i/t2i.types';

import { convert_Base64_To_UInt8Array, convert_UInt8Array_To_Base64 } from '~/common/util/blobUtils';

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

// Image generation (T2I) input - reference images are a copy of AixWire_Parts.InlineImagePart_schema (kept separate, as in openai.router)
const createImagesInputSchema = z.object({
  access: geminiAccessSchema,
  generationConfig: z.object({
    model: z.string().regex(/^models\/[a-z0-9.-]+$/, 'invalid Gemini model id'),
    prompt: z.string(),
    aspectRatio: GeminiWire_API_Generate_Content.ImageAspectRatio_enum.optional(),
    imageSize: GeminiWire_API_Generate_Content.ImageSize_enum.optional(),
  }),
  editConfig: z.object({
    inputImages: z.array(z.object({
      pt: z.literal('inline_image'),
      mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      base64: z.string(),
    })),
  }).optional(),
  t2iContextName: z.enum(T2I_CONTEXT_NAMES),
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


  // --- [Gemini] Image generation (T2I) ---

  /**
   * One Nano Banana image per call: generateContent with the reference images (if any) before the prompt.
   * Thought images (drafts, emitted at thinking 'high') are skipped; the model's text becomes the alt text.
   */
  createImages: edgeProcedure
    .input(createImagesInputSchema)
    .mutation(async function* ({ input, signal }): AsyncGenerator<T2ICreateImageAsyncStreamOp> {

      const { access, generationConfig: config, editConfig } = input;

      // -> state.started
      yield { p: 'state', state: 'started' };

      const { headers, url } = geminiAccess(access, config.model, GeminiWire_API_Generate_Content.postPath, false);
      const body: GeminiWire_API_Generate_Content.Request = {
        contents: [{
          role: 'user',
          parts: [
            ...(editConfig?.inputImages ?? []).map(image => GeminiWire_ContentParts.InlineDataPart(image.mimeType, image.base64)),
            GeminiWire_ContentParts.TextPart(config.prompt),
          ],
        }],
        safetySettings: geminiSafetySettings(access.minSafetyLevel),
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          ...((config.aspectRatio || config.imageSize) && {
            imageConfig: {
              ...(config.aspectRatio && { aspectRatio: config.aspectRatio }),
              ...(config.imageSize && { imageSize: config.imageSize }),
            },
          }),
        },
      };

      // -> heartbeats, while waiting for the generation response (4K takes 60-90s)
      const wireResponse = yield* heartbeatsWhileAwaiting(
        fetchJsonOrTRPCThrow<object, GeminiWire_API_Generate_Content.Request>({ url, method: 'POST', headers, body, signal, name: 'Gemini' })
          .catch((error: any) => {
            if (signal?.aborted)
              return null; // connection already gone
            throw error;
          }),
      );
      if (!wireResponse) return;

      const response = GeminiWire_API_Generate_Content.Response_schema.parse(wireResponse);
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];

      // the model's (non-thought) text, if any, describes the image
      const altText = parts.map(part => 'text' in part && !part.thought ? part.text.trim() : '').filter(Boolean).join('\n') || config.prompt;

      let imageCount = 0;
      for (const part of parts) {
        if (!('inlineData' in part) || part.thought || !part.inlineData.mimeType.startsWith('image/'))
          continue;

        let { mimeType } = part.inlineData;
        let width = 0, height = 0;
        try {
          ({ mimeType, width, height } = getImageInformationFromBytes(convert_Base64_To_UInt8Array(part.inlineData.data, 'llms.gemini.createImages').buffer));
        } catch (error) {
          console.warn(`gemini.router.createImages: could not sniff image (${mimeType})`, error);
        }

        // -> createImage
        imageCount++;
        yield {
          p: 'createImage',
          image: {
            mimeType,
            base64Data: part.inlineData.data,
            altText,
            width,
            height,
            ...(response.usageMetadata?.promptTokenCount !== undefined ? { inputTokens: response.usageMetadata.promptTokenCount } : {}),
            ...(response.usageMetadata?.candidatesTokenCount !== undefined ? { outputTokens: response.usageMetadata.candidatesTokenCount } : {}),
            generatorName: config.model,
            parameters: {
              model: config.model,
              ...(config.aspectRatio && { aspectRatio: config.aspectRatio }),
              ...(config.imageSize && { imageSize: config.imageSize }),
            },
            generatedAt: new Date().toISOString(),
          },
        };
      }

      // no image: surface why (e.g. IMAGE_SAFETY, IMAGE_RECITATION, a text-only refusal)
      if (!imageCount) {
        const reason = response.promptFeedback?.blockReason || candidate?.finishReason || 'no image returned';
        const message = candidate?.finishMessage || (altText !== config.prompt ? altText : '');
        throw new TRPCError({ code: 'BAD_REQUEST', message: `[Gemini] ${reason}${message ? `: ${message}` : ''}` });
      }
    }),


  // --- [Gemini] Files API ---

  /**
   * Download bytes. The media URL rejects unregistered callers (403), so we proxy it through the key.
   * Used by the hosted-video chip to download or re-play an Omni artifact within its 48h TTL.
   */
  fileApiDownload: edgeProcedure
    .input(z.object({ access: geminiAccessSchema, fileName: geminiFileNameSchema }))
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
        base64Data: convert_UInt8Array_To_Base64(new Uint8Array(arrayBuffer), 'llms.gemini.fileDownload'),
        mimeType: response.headers.get('content-type') || 'application/octet-stream',
      };
    }),

  /**
   * Metadata (files.get): size, mime, expiry (createTime + 48h), state. A 404 means the
   * file has expired/been deleted - the chip surfaces that as 'no longer available'.
   */
  fileApiGetMetadata: edgeProcedure
    .input(z.object({ access: geminiAccessSchema, fileName: geminiFileNameSchema }))
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

  /**
   * Resumable upload START for CSF-off services: the server holds the key, performs the start
   * (forwarding the browser Origin - Google binds the upload session's CORS grant at start time,
   * verified 2026-08-28), and returns the key-free bearer upload URL (upload_id only). The BYTES
   * then go browser -> Google directly, so MB-scale payloads never traverse the edge fn.
   */
  fileApiUploadStart: edgeProcedure
    .input(z.object({
      access: geminiAccessSchema,
      sizeBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024), // Files API cap: 2GB
      mimeType: z.string().max(256),
      displayName: z.string().max(128),
      origin: z.string().max(256).optional(), // uploader's browser origin - scopes the session's CORS grant
    }))
    .mutation(async ({ input: { access, sizeBytes, mimeType, displayName, origin } }) => {
      const { headers, url } = geminiAccess(access, null, '/upload/v1beta/files', false);
      const response = await fetchResponseOrTRPCThrow({
        url,
        method: 'POST',
        headers: {
          ...headers,
          ...(origin ? { 'Origin': origin } : {}),
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(sizeBytes),
          'X-Goog-Upload-Header-Content-Type': mimeType,
        },
        body: { file: { display_name: displayName } },
        name: 'Gemini',
      });
      const uploadUrl = response.headers.get('x-goog-upload-url');
      if (!uploadUrl || uploadUrl.includes('key='))
        throw new Error('Gemini upload start returned an unusable upload URL'); // never hand a key-bearing URL to the client
      return { uploadUrl };
    }),

  /**
   * Delete a file from Google now (before its 48h TTL): DELETE /v1beta/files/{id} -> 200.
   * Used when the user removes a generated-video chip, so the artifact doesn't linger server-side.
   */
  fileApiDelete: edgeProcedure
    .input(z.object({ access: geminiAccessSchema, fileName: geminiFileNameSchema }))
    .mutation(async ({ input: { access, fileName } }) => {
      const { headers, url } = geminiAccess(access, null, `/v1beta/${fileName}`, false);
      await fetchResponseOrTRPCThrow({ url, method: 'DELETE', headers, name: 'Gemini' });
      return { deleted: true };
    }),

});
