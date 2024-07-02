import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';

import { aixChatGenerateInputSchema } from '../shared/aix.shared.chat';
import { testStreamStress } from './aix.router.debug';


// const chatStreamingInputSchema = z.object({
//   access: z.discriminatedUnion('dialect', [anthropicAccessSchema, geminiAccessSchema, ollamaAccessSchema, openAIAccessSchema]),
//   model: openAIModelSchema,
//   history: openAIHistorySchema,
//   tools: llmsToolsSchema.optional(),
//   context: llmsStreamingContextSchema,
// });

// const chatStreamingOutputSchema = z.object({
//   test: z.string(),
//   me: z.number(),
// });


export const aixRouter = createTRPCRouter({

  streamingChatGenerate: publicProcedure
    .input(aixChatGenerateInputSchema)
    .mutation(async function* ({ input: { tools, toolPolicy } }) {

      console.log('Streaming chat generation started');

      try {
        // You can use input here if needed
        // const { tools, toolPolicy } = input;

        yield* testStreamStress(true);
      } catch (error) {
        console.error('Error in streamingChatGenerate:', error);
        throw error;
      } finally {
        console.log('Streaming chat generation completed');
      }

    }),

});
