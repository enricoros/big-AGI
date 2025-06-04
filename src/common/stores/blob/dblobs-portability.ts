// Direct re-exports - no proxy functions needed
export {
  // Image operations
  addDBImageAsset,
  getImageAsset,
  gcDBImageAssets,
} from '~/modules/dblobs/dblobs.images';

export {
  // Generic operations
  deleteDBAsset,
  transferDBAssetContextScope,
  gcDBAssetsByScope,
  getDBAsset, // Add this if used directly
} from '~/modules/dblobs/dblobs.db';

export {
  // React hooks
  useDBAsset,
  useDBAssetsByScopeAndType,
} from '~/modules/dblobs/dblobs.hooks';

// Re-export all types
export * from '~/modules/dblobs/dblobs.types';
