import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/modules/trpc/trpc.server';

import { postToPasteGGOrThrow } from './pastegg.server';


const publishToInputSchema = z.object({
  to: z.enum(['paste.gg']),
  title: z.string(),
  fileContent: z.string(),
  fileName: z.string(),
  origin: z.string(),
});

const publishToOutputSchema = z.object({
  url: z.string(),
  expires: z.string(),
  deletionKey: z.string(),
  created: z.string(),
});

export type PublishedSchema = z.infer<typeof publishToOutputSchema>;


// const openAIImportInputSchema = z.object({
//   url: z.string().url().startsWith('https://chat.openai.com/share/'),
// });


export const sharingRouter = createTRPCRouter({

  // /**
  //  *
  //  */
  // importOpenAIShare: publicProcedure
  //   .input(openAIImportInputSchema)
  //   // .output(ChatDataSchema)
  //   .mutation(async ({ input }) => {
  //     const { url } = input;
  //
  //     const htmlPage = await fetchTextOrTRPCError(url, 'GET', {}, undefined, 'OpenAI Importer');
  //
  //     // Extract the JSON object from the HTML string
  //     const jsonString = htmlPage.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/)?.[1];
  //     if (!jsonString)
  //       throw new Error('JSON object not found in the HTML string');
  //
  //     // // Parse the chat data using the Zod schema
  //     // const chatData = jsonObject.props.pageProps.serverResponse.data;
  //     // try {
  //     //   const parsedChatData = ChatDataSchema.parse(chatData);
  //     //   // Construct the Chat data structure (left blank for now)
  //     //   return parsedChatData;
  //     // } catch (error) {
  //     //   throw new TRPCError({
  //     //     code: 'BAD_REQUEST',
  //     //     message: `Failed to parse chat data: ${error.message}`,
  //     //   });
  //     // }
  //   }),

  /**
   * Publish a file (with title, content, name) to a sharing service
   * For now only 'paste.gg' is supported
   */
  publishTo: publicProcedure
    .input(publishToInputSchema)
    .output(publishToOutputSchema)
    .mutation(async ({ input }) => {

      const { to, title, fileContent, fileName, origin } = input;
      if (to !== 'paste.gg' || !title || !fileContent || !fileName)
        throw new Error('Invalid options');

      const paste = await postToPasteGGOrThrow(title, fileName, fileContent, origin);
      if (paste?.status !== 'success')
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${paste?.error || 'Unknown error'}. ${paste?.message || 'Unknown cause'}`.trim(),
        });

      const result = paste.result;
      return {
        url: `https://paste.gg/${result.id}`,
        expires: result.expires || 'never',
        deletionKey: result.deletion_key || 'none',
        created: result.created_at,
      };
    }),

});