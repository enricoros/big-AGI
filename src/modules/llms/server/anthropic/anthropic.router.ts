import * as z from 'zod/v4';

import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';
import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { ListModelsResponse_schema } from '../llm.server.types';
import { listModelsRunDispatch } from '../listModels.dispatch';

import { anthropicAccess, anthropicAccessSchema, AnthropicAccessSchema, AnthropicHeaderOptions } from './anthropic.access';


// Mappers

async function anthropicGETOrThrow<TOut extends object>(access: AnthropicAccessSchema, apiPath: string, options?: AnthropicHeaderOptions, signal?: AbortSignal): Promise<TOut> {
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
      return await anthropicGETOrThrow(access, '/v1/skills', { enableSkills: true });
    }),

  /* [Anthropic] get skill details */
  getSkill: edgeProcedure
    .input(z.object({
      access: anthropicAccessSchema,
      skillId: z.string(),
    }))
    .query(async ({ input: { access, skillId } }) => {
      return await anthropicGETOrThrow(access, `/v1/skills/${skillId}`, { enableSkills: true });
    }),

  /* [Anthropic] get file metadata - for Skills-generated files */
  getFileMetadata: edgeProcedure
    .input(z.object({
      access: anthropicAccessSchema,
      fileId: z.string(),
    }))
    .query(async ({ input: { access, fileId } }) => {
      return await anthropicGETOrThrow(access, `/v1/files/${fileId}`, { enableSkills: true });
    }),

  /* [Anthropic] download file - for Skills-generated files */
  downloadFile: edgeProcedure
    .input(z.object({
      access: anthropicAccessSchema,
      fileId: z.string(),
    }))
    .query(async ({ input: { access, fileId } }) => {
      // Return file data - could be integrated with ZYNC Assets in the future
      return await anthropicGETOrThrow(access, `/v1/files/${fileId}/download`, { enableSkills: true });
    }),

});
