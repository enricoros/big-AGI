import { z } from 'zod';

import { LinkStorageDataType, LinkStorageVisibility } from '@prisma/client';

import { prismaDb } from '~/server/prisma/prismaDb';
import { publicProcedure } from '~/server/trpc/trpc.server';

import { agiUuid } from '~/common/util/idUtils';


// configuration
const DEFAULT_EXPIRES_SECONDS = 60 * 60 * 24 * 30; // 30 days


/// Zod schemas

const dataTypesSchema = z.enum([LinkStorageDataType.CHAT_V1]);
const dataSchema = z.object({}).passthrough();


const storagePutInputSchema = z.object({
  ownerId: z.string().optional(),
  dataType: dataTypesSchema,
  dataTitle: z.string().optional(),
  dataObject: dataSchema,
  expiresSeconds: z.number().optional(),
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
    dataObject: dataSchema,
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
    .mutation(async ({ input }) => {

      const { ownerId, dataType, dataTitle, dataObject, expiresSeconds } = input;

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
          dataSize: JSON.stringify(dataObject).length, // data size estimate
          data: dataObject,
          expiresAt: expiresSeconds === 0
            ? undefined // never expires
            : new Date(Date.now() + 1000 * (expiresSeconds || DEFAULT_EXPIRES_SECONDS)), // default
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