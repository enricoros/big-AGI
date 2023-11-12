import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { fetchTextOrTRPCError } from '~/server/api/trpc.serverutils';

import { chatGptParseConversation, chatGptSharedChatSchema } from './import.chatgpt';
import { postToPasteGGOrThrow, publishToInputSchema, publishToOutputSchema } from './publish.pastegg';
import { storageDeleteOutputSchema, storageGetProcedure, storageMarkAsDeletedProcedure, storagePutOutputSchema, storagePutProcedure } from './storage.server';


export type StoragePutSchema = z.infer<typeof storagePutOutputSchema>;

export type StorageDeleteSchema = z.infer<typeof storageDeleteOutputSchema>;

export type PublishedSchema = z.infer<typeof publishToOutputSchema>;


export const tradeRouter = createTRPCRouter({

  /**
   * ChatGPT Shared Chats Importer
   */
  importChatGptShare: publicProcedure
    .input(z.object({ url: z.string().url().startsWith('https://chat.openai.com/share/') }))
    .output(z.object({ data: chatGptSharedChatSchema, conversationId: z.string() }))
    .query(async ({ input: { url } }) => {

      // add headers that make it closest to a browser request
      const htmlPage = await fetchTextOrTRPCError(url, 'GET', {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      }, undefined, 'ChatGPT Importer');

      const data = chatGptParseConversation(htmlPage);

      return {
        data: data.props.pageProps.serverResponse.data,
        conversationId: data.props.pageProps.sharedConversationId,
      };
    }),

  /**
   * Write an object to storage, and return the ID, owner, and deletion key
   */
  storagePut: storagePutProcedure,

  /**
   * Read a stored object by ID (optional owner)
   */
  storageGet: storageGetProcedure,

  /**
   * Delete a stored object by ID and deletion key
   */
  storageDelete: storageMarkAsDeletedProcedure,

  /**
   * Publish a text file (with title, content, name) to a sharing service
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