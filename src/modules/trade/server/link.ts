import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { LinkStorageDataType, LinkStorageVisibility } from '@prisma/client';

import { prismaDb } from '~/server/prisma/prismaDb';
import { publicProcedure } from '~/server/trpc/trpc.server';

import { agiUuid } from '~/common/util/idUtils';


// configuration
const DEFAULT_EXPIRES_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MIN_EXPIRES_SECONDS = 60 * 60; // 1 hour
const MAX_EXPIRES_SECONDS = DEFAULT_EXPIRES_SECONDS;
export const STORAGE_PUT_MAX_DATA_SIZE = 5 * 1024 * 1024; // 5 MB of serialized JSON
const MAX_TITLE_LENGTH = 512;
const PUT_RATE_LIMIT_MAX = 30; // puts per client per window
const PUT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const PUT_RATE_LIMIT_MAX_TRACKED = 10_000;


/// Rate limiting (best-effort, in-memory, per server instance)

const putRateLimits = new Map<string, { count: number, resetAt: number }>();

function _consumePutRateLimit(clientKey: string): boolean {
  const now = Date.now();

  // prune expired windows, and hard-cap the tracked clients
  if (putRateLimits.size >= PUT_RATE_LIMIT_MAX_TRACKED) {
    for (const [key, entry] of putRateLimits)
      if (entry.resetAt <= now) putRateLimits.delete(key);
    if (putRateLimits.size >= PUT_RATE_LIMIT_MAX_TRACKED)
      putRateLimits.clear();
  }

  const entry = putRateLimits.get(clientKey);
  if (!entry || entry.resetAt <= now) {
    putRateLimits.set(clientKey, { count: 1, resetAt: now + PUT_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= PUT_RATE_LIMIT_MAX)
    return false;
  entry.count++;
  return true;
}


/// Zod schemas

const dataTypesSchema = z.enum([LinkStorageDataType.CHAT_V1]);


const storagePutInputSchema = z.object({
  ownerId: z.string().max(128).optional(),
  dataType: dataTypesSchema,
  dataTitle: z.string().optional(),
  dataObject: z.any(), // was .passthrough()
  expiresSeconds: z.number().int().min(MIN_EXPIRES_SECONDS).max(MAX_EXPIRES_SECONDS).optional(),
});

export const storagePutOutputSchema = z.union([
  z.object({
    type: z.literal('success'),
    objectId: z.string(),
    ownerId: z.string(),
    createdAt: z.date(),
    expiresAt: z.date().nullable(),
    deletionKey: z.string(),
    dataTitle: z.string().nullable(),
  }),
  z.object({
    type: z.literal('error'),
    error: z.string(),
  }),
]);

const storageGetInputSchema = z.object({
  objectId: z.string(),
  ownerId: z.string().optional(),
});

export const storageGetOutputSchema = z.union([
  z.object({
    type: z.literal('success'),
    dataType: dataTypesSchema,
    dataTitle: z.string().nullable(),
    dataObject: z.any(), // was .passthrough()
    storedAt: z.date(),
    expiresAt: z.date().nullable(),
  }),
  z.object({
    type: z.literal('error'),
    error: z.string(),
  }),
]);

const storageDeleteInputSchema = z.object({
  objectId: z.string(),
  ownerId: z.string().optional(),
  deletionKey: z.string(),
});

export const storageDeleteOutputSchema = z.object({
  type: z.enum(['success', 'error']),
  error: z.string().optional(),
});

const storageUpdateDeletionKeyInputSchema = z.object({
  objectId: z.string(),
  ownerId: z.string().optional(),
  formerKey: z.string(),
  newKey: z.string(),
});

export const storageUpdateDeletionKeyOutputSchema = z.object({
  type: z.enum(['success', 'error']),
  error: z.string().optional(),
});


export type StoragePutSchema = z.infer<typeof storagePutOutputSchema>;
export type StorageDeleteSchema = z.infer<typeof storageDeleteOutputSchema>;
export type StorageUpdateDeletionKeySchema = z.infer<typeof storageUpdateDeletionKeyOutputSchema>;


/// tRPC procedures

/**
 * Writes dataObject to DB, returns ownerId, objectId, and deletionKey
 */
export const storagePutProcedure =
  publicProcedure
    .input(storagePutInputSchema)
    .output(storagePutOutputSchema)
    .mutation(async ({ input, ctx }) => {

      const { ownerId, dataType, dataObject, expiresSeconds } = input;
      const dataTitle = input.dataTitle?.slice(0, MAX_TITLE_LENGTH);

      if (typeof dataObject !== 'object' || dataObject === null)
        return { type: 'error', error: 'Invalid data' };

      const dataSize = JSON.stringify(dataObject).length;
      if (dataSize > STORAGE_PUT_MAX_DATA_SIZE)
        return { type: 'error', error: `Data too large (max ${Math.round(STORAGE_PUT_MAX_DATA_SIZE / 1024 / 1024)} MB)` };

      if (!_consumePutRateLimit(ctx.clientIp))
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many shared links created, please try again later.' });

      const { id: objectId, ...rest } = await prismaDb.linkStorage.create({
        select: {
          id: true,
          ownerId: true,
          createdAt: true,
          expiresAt: true,
          deletionKey: true,
        },
        data: {
          id: agiUuid('server-storage-id'),
          ownerId: ownerId || agiUuid('server-storage-owner'),
          visibility: LinkStorageVisibility.UNLISTED,
          dataType,
          dataTitle,
          dataSize, // data size estimate
          data: dataObject,
          expiresAt: new Date(Date.now() + 1000 * (expiresSeconds ?? DEFAULT_EXPIRES_SECONDS)), // always expires
          deletionKey: agiUuid('server-storage-deletion-key'),
          isDeleted: false,
        },
      });

      return {
        type: 'success',
        objectId,
        dataTitle: dataTitle || null,
        ...rest,
      };

    });


/**
 * Reads an object from DB, if it exists, and is not expired, and is not marked as deleted
 */
export const storageGetProcedure =
  publicProcedure
    .input(storageGetInputSchema)
    .output(storageGetOutputSchema)
    .query(async ({ input: { objectId, ownerId } }) => {

      // read object
      const result = await prismaDb.linkStorage.findUnique({
        select: {
          dataType: true,
          dataTitle: true,
          data: true,
          createdAt: true,
          expiresAt: true,
        },
        where: {
          id: objectId,
          ownerId: ownerId || undefined,
          isDeleted: false,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      // if not found, return error
      if (!result)
        return {
          type: 'error',
          error: 'Not found',
        };

      if (typeof result.data !== 'object' || result.data === null)
        return {
          type: 'error',
          error: 'Invalid data',
        };

      // increment the read count
      // NOTE: fire-and-forget; we don't care about the result
      {
        prismaDb.linkStorage.update({
          select: {
            id: true,
          },
          where: {
            id: objectId,
          },
          data: {
            readCount: {
              increment: 1,
            },
          },
        }).catch(() => null);
      }

      return {
        type: 'success',
        dataType: result.dataType,
        dataTitle: result.dataTitle,
        dataObject: result.data as any,
        storedAt: result.createdAt,
        expiresAt: result.expiresAt,
      };

    });


/**
 * Mark a public object as deleted, if it exists, and is not expired, and is not deleted
 */
export const storageMarkAsDeletedProcedure =
  publicProcedure
    .input(storageDeleteInputSchema)
    .output(storageDeleteOutputSchema)
    .mutation(async ({ input: { objectId, ownerId, deletionKey } }) => {

      const result = await prismaDb.linkStorage.updateMany({
        where: {
          id: objectId,
          ownerId: ownerId || undefined,
          deletionKey,
          // isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      const success = result.count === 1;

      return {
        type: success ? 'success' : 'error',
        error: success ? undefined : 'invalid deletion key?',
      };
    });


/**
 * Update the deletion Key of a public object by ID and deletion key
 */
export const storageUpdateDeletionKeyProcedure =
  publicProcedure
    .input(storageUpdateDeletionKeyInputSchema)
    .output(storageUpdateDeletionKeyOutputSchema)
    .mutation(async ({ input: { objectId, ownerId, formerKey, newKey } }) => {

      const result = await prismaDb.linkStorage.updateMany({
        where: {
          id: objectId,
          ownerId: ownerId || undefined,
          deletionKey: formerKey,
          // isDeleted: false,
        },
        data: {
          deletionKey: newKey,
        },
      });

      const success = result.count === 1;

      return {
        type: success ? 'success' : 'error',
        error: success ? undefined : 'invalid former key',
      };
    });