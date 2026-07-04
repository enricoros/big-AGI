import { createTRPCRouter } from '~/server/trpc/trpc.server';

import { storageGetProcedure, storageMarkAsDeletedProcedure, storagePutProcedure, storageUpdateDeletionKeyProcedure } from './link';


export const tradeRouter = createTRPCRouter({

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
   * Update the deletion Key of a stored object by ID and deletion key
   */
  storageUpdateDeletionKey: storageUpdateDeletionKeyProcedure,

});
