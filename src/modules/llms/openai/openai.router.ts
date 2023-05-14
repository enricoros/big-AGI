import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/modules/trpc/trpc.server';

import { OpenAI } from '../../openai/openai.types';


const accessSchema = z.object({
  oaiKey: z.string().trim(),
  oaiOrg: z.string().trim(),
  oaiHost: z.string().trim(),
  heliKey: z.string().trim(),
});


export const openAIRouter = createTRPCRouter({

  /**
   * List the Models available
   */
  listModels: publicProcedure
    .input(accessSchema)
    .query(async ({ input }): Promise<OpenAI.Wire.Models.ModelDescription[]> => {
      const wireModels = await openaiGET<OpenAI.Wire.Models.Response>(input, '/v1/models');
      const llms = wireModels.data?.filter(model => model.id.includes('gpt')) ?? [];

      // sort by which model has the least number of '-' in the name, and then by id, decreasing
      llms.sort((a, b) => {
        const aCount = a.id.split('-').length;
        const bCount = b.id.split('-').length;
        if (aCount === bCount)
          return b.id.localeCompare(a.id);
        return aCount - bCount;
      });

      return llms;
    }),

});


export type Access = z.infer<typeof accessSchema>;

async function openaiGET<TOut>(input: Access, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = openAIAccess(input, apiPath);
  const response = await fetch(url, { headers });
  return await response.json() as TOut;
}

function openAIAccess(input: Access, apiPath: string): { headers: HeadersInit, url: string } {
  // API key
  const oaiKey = input.oaiKey || process.env.OPENAI_API_KEY || '';
  if (!oaiKey) throw new Error('Missing OpenAI API Key. Add it on the client side (Settings icon) or server side (your deployment).');

  // Organization ID
  const oaiOrg = input.oaiOrg || process.env.OPENAI_API_ORG_ID || '';

  // API host
  let oaiHost = input.oaiHost || process.env.OPENAI_API_HOST || 'https://api.openai.com';
  if (!oaiHost.startsWith('http'))
    oaiHost = `https://${oaiHost}`;
  if (oaiHost.endsWith('/') && apiPath.startsWith('/'))
    oaiHost = oaiHost.slice(0, -1);

  // Helicone key
  const heliKey = input.heliKey || process.env.HELICONE_API_KEY || '';

  return {
    headers: {
      Authorization: `Bearer ${oaiKey}`,
      'Content-Type': 'application/json',
      ...(oaiOrg && { 'OpenAI-Organization': oaiOrg }),
      ...(heliKey && { 'Helicone-Auth': `Bearer ${heliKey}` }),
    },
    url: oaiHost + apiPath,
  };
}
