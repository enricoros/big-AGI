import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/modules/trpc/trpc.server';
import { fetchTextOrTRPCError } from '~/modules/trpc/trpc.serverutils';

import { chatGptImportConversation, chatGptSharedChatSchema } from './import.chatgpt';
import { postToPasteGGOrThrow } from './publish.pastegg';


const chatGptImportInputSchema = z.object({
  url: z.string().url().startsWith('https://chat.openai.com/share/'),
});

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
   * ChatGPT Shared Chats Importer
   */
  importChatGptShare: publicProcedure
    .input(chatGptImportInputSchema)
    .output(z.object({ data: chatGptSharedChatSchema, conversationId: z.string() }))
    .query(async ({ input: { url } }) => {
      const htmlPage = await fetchTextOrTRPCError(url, 'GET', {}, undefined, 'ChatGPT Importer');
      const data = await chatGptImportConversation(htmlPage);
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