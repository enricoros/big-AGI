import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/modules/trpc/trpc.server';
import { fetchTextOrTRPCError } from '~/modules/trpc/trpc.serverutils';

import { openaiChatDataSchema, openAIImportSharedConversation } from './import.openai';
import { postToPasteGGOrThrow } from './publish.pastegg';


// OpenAI import

const openAIImportInputSchema = z.object({
  url: z.string().url().startsWith('https://chat.openai.com/share/'),
});


// publishTo

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


export const sharingRouter = createTRPCRouter({

  /**
   * OpenAI Shared Chats Importer
   */
  importOpenAIShare: publicProcedure
    .input(openAIImportInputSchema)
    .output(z.object({ data: openaiChatDataSchema, conversationId: z.string() }))
    .query(async ({ input: { url } }) => {
      const htmlPage = await fetchTextOrTRPCError(url, 'GET', {}, undefined, 'OpenAI Importer');
      const data = await openAIImportSharedConversation(htmlPage);
      return {
        data: data.props.pageProps.serverResponse.data,
        conversationId: data.props.pageProps.sharedConversationId,
      };
    }),

  /**
   * Publish a file (with title, content, name) to a sharing service
   * For now only 'paste.gg' is supported
   */
  publishTo: publicProcedure
    .input(publishToInputSchema)
    .output(publishToOutputSchema)
    .mutation(async ({ input: { to, title, fileContent, fileName, origin } }) => {
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