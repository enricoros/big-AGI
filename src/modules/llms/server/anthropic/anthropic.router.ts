import * as z from 'zod/v4';

import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';
import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow, fetchTextOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { FileMetadataResponse_schema, ListModelsResponse_schema } from '../llm.server.types';
import { listModelsRunDispatch } from '../listModels.dispatch';

import { ANTHROPIC_API_PATHS, anthropicAccess, AnthropicAccessSchema, anthropicAccessSchema, AnthropicHostedFeatures } from './anthropic.access';


// Mappers

async function anthropicGETOrThrow<TOut extends object>(access: AnthropicAccessSchema, apiPath: string, options?: AnthropicHostedFeatures, signal?: AbortSignal): Promise<TOut> {
  const { headers, url } = anthropicAccess(access, apiPath, options);
  return await fetchJsonOrTRPCThrow<TOut>({ url, headers, name: 'Anthropic', signal });
}


// Input Schemas

const listModelsInputSchema = z.object({
  access: anthropicAccessSchema,
});


// Router

export const llmAnthropicRouter = createTRPCRouter({

  /* [Anthropic] list models - https://docs.anthropic.com/claude/docs/models-overview */
  listModels: edgeProcedure
    .input(listModelsInputSchema)
    .output(ListModelsResponse_schema)
    .query(async ({ input: { access }, signal }) => {

      const models = await listModelsRunDispatch(access, signal);

      return { models };
    }),

  /* [Anthropic] list skills - https://docs.anthropic.com/en/docs/build-with-claude/skills-api */
  listSkills: edgeProcedure
    .input(z.object({ access: anthropicAccessSchema }))
    .query(async ({ input: { access } }) => {
      return await anthropicGETOrThrow(access, ANTHROPIC_API_PATHS.skills, { enableSkills: true });
    }),

  /* [Anthropic] get skill details */
  getSkill: edgeProcedure
    .input(z.object({
      access: anthropicAccessSchema,
      skillId: z.string(),
    }))
    .query(async ({ input: { access, skillId } }) => {
      return await anthropicGETOrThrow(access, `${ANTHROPIC_API_PATHS.skills}/${skillId}`, { enableSkills: true });
    }),

  /* [Anthropic] Files API - delete file permanently from Anthropic servers */
  fileApiDelete: edgeProcedure
    .input(z.object({
      access: anthropicAccessSchema,
      fileId: z.string(),
    }))
    .mutation(async ({ input: { access, fileId } }) => {
      const { headers, url } = anthropicAccess(access, `${ANTHROPIC_API_PATHS.files}/${fileId}`, { enableSkills: true, enableCodeExecution: true });
      await fetchTextOrTRPCThrow({ url, headers, method: 'DELETE', name: 'Anthropic' });
      return { success: true };
    }),

  /* [Anthropic] Files API - download file content */
  fileApiDownload: edgeProcedure
    .input(z.object({
      access: anthropicAccessSchema,
      fileId: z.string(),
    }))
    .query(async ({ input: { access, fileId } }) => {
      const { headers, url } = anthropicAccess(access, `${ANTHROPIC_API_PATHS.files}/${fileId}/content`, { enableSkills: true, enableCodeExecution: true });
      const response = await fetchResponseOrTRPCThrow({ url, headers, name: 'Anthropic' });

      // Guard against excessively large files (10 MB limit)
      const MAX_FILE_BYTES = 10 * 1024 * 1024;
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

  /* [Anthropic] Files API - get file metadata */
  fileApiGetMetadata: edgeProcedure
    .input(z.object({
      access: anthropicAccessSchema,
      fileId: z.string(),
    }))
    .output(FileMetadataResponse_schema)
    .query(async ({ input: { access, fileId } }) => {
      return await anthropicGETOrThrow(access, `${ANTHROPIC_API_PATHS.files}/${fileId}`, { enableSkills: true, enableCodeExecution: true });
    }),

});
