import { z } from 'zod';

import { SharingDataType } from '@prisma/client';

import { db } from '~/server/db';
import { publicProcedure } from '~/server/api/trpc.server';
import { v4 as uuidv4 } from 'uuid';


/// Zod schemas

const dataTypesSchema = z.enum([SharingDataType.CHAT_V1]);
const dataSchema = z.object({}).nonstrict();


const sharePutInputSchema = z.object({
  ownerId: z.string().optional(),
  dataType: dataTypesSchema,
  dataObject: dataSchema,
  expiresSeconds: z.number().optional(),
});

export const sharePutOutputSchema = z.union([
  z.object({
    type: z.literal('success'),
    sharedId: z.string(),
    ownerId: z.string(),
    expiresAt: z.date().nullable(),
    deletionKey: z.string(),
    createdAt: z.date(),
  }),
  z.object({
    type: z.literal('error'),
    error: z.string(),
  }),
]);

const shareGetInputSchema = z.object({
  sharedId: z.string(),
});

export const shareGetOutputSchema = z.union([
  z.object({
    type: z.literal('success'),
    dataType: dataTypesSchema,
    dataObject: dataSchema,
    expiresAt: z.date().nullable(),
  }),
  z.object({
    type: z.literal('error'),
    error: z.string(),
  }),
]);

const shareDeleteInputSchema = z.object({
  sharedId: z.string(),
  deletionKey: z.string(),
});

export const shareDeleteOutputSchema = z.object({
  type: z.enum(['success', 'error']),
  error: z.string().optional(),
});


/// tRPC procedures

/**
 * Writes dataObject to DB, returns sharedId / ownerId
 */
export const sharePutProcedure =
  publicProcedure
    .input(sharePutInputSchema)
    .output(sharePutOutputSchema)
    .mutation(async ({ input: { ownerId, dataType, dataObject, expiresSeconds } }) => {

      // expire in 30 days, if unspecified
      if (!expiresSeconds)
        expiresSeconds = 60 * 60 * 24 * 30;

      const dataSizeEstimate = JSON.stringify(dataObject).length;

      const { id: sharedId, ...rest } = await db.sharing.create({
        select: {
          id: true,
          ownerId: true,
          createdAt: true,
          expiresAt: true,
          deletionKey: true,
        },
        data: {
          ownerId: ownerId || uuidv4(),
          isPublic: true,
          dataType,
          dataSize: dataSizeEstimate,
          data: dataObject,
          expiresAt: new Date(Date.now() + 1000 * expiresSeconds),
          deletionKey: uuidv4(),
          isDeleted: false,
        },
      });

      return {
        type: 'success',
        sharedId,
        ...rest,
      };

    });


/**
 * Read a public object from DB, if it exists, and is not expired, and is not deleted
 */
export const shareGetProducedure =
  publicProcedure
    .input(shareGetInputSchema)
    .output(shareGetOutputSchema)
    .query(async ({ input: { sharedId } }) => {

      // read object
      const result = await db.sharing.findUnique({
        select: {
          dataType: true,
          data: true,
          expiresAt: true,
        },
        where: {
          id: sharedId,
          isPublic: true,
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
        db.sharing.update({
          select: {
            id: true,
          },
          where: {
            id: sharedId,
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
        dataObject: result.data as any,
        expiresAt: result.expiresAt,
      };

    });


/**
 * Mark a public object as deleted, if it exists, and is not expired, and is not deleted
 */
export const shareDeleteProcedure =
  publicProcedure
    .input(shareDeleteInputSchema)
    .output(shareDeleteOutputSchema)
    .mutation(async ({ input: { sharedId, deletionKey } }) => {

      const result = await db.sharing.updateMany({
        where: {
          id: sharedId,
          deletionKey,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      const success = result.count === 1;

      return {
        type: success ? 'success' : 'error',
        error: success ? undefined : 'Not found',
      };
    });
