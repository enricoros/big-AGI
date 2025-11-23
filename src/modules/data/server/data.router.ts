/**
 * tRPC router for data import operations
 * Provides server-side endpoints for data import if needed
 */

import * as z from 'zod/v4';
import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';


/**
 * Data import router
 * Currently minimal - most import operations happen client-side
 */
export const dataRouter = createTRPCRouter({

  /**
   * Validate a data import file (server-side validation)
   * This can be used for large files or security checks
   */
  validateImportFile: publicProcedure
    .input(z.object({
      vendorId: z.enum(['typingmind', 'chatgpt', 'bigagi']),
      fileSize: z.number(),
      fileHash: z.string(),
    }))
    .output(z.object({
      valid: z.boolean(),
      message: z.string().optional(),
    }))
    .query(async ({ input }: { input: { vendorId: string; fileSize: number; fileHash: string } }) => {
      // Basic validation
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

      if (input.fileSize > MAX_FILE_SIZE) {
        return {
          valid: false,
          message: `File too large: ${(input.fileSize / 1024 / 1024).toFixed(2)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        };
      }

      if (input.fileSize === 0) {
        return {
          valid: false,
          message: 'File is empty',
        };
      }

      // All checks passed
      return {
        valid: true,
      };
    }),

  /**
   * Get import statistics
   * Returns information about previous imports if tracked
   */
  getImportStats: publicProcedure
    .output(z.object({
      totalImports: z.number(),
      recentImports: z.array(z.object({
        vendorId: z.string(),
        fileName: z.string(),
        conversationCount: z.number(),
        importedAt: z.number(),
      })),
    }))
    .query(async () => {
      // For now, return empty stats
      // This could be expanded to track import history in the future
      return {
        totalImports: 0,
        recentImports: [],
      };
    }),

});


export type DataRouter = typeof dataRouter;
