import { Is } from '~/common/util/pwaUtils';
import { createBlobURLFromData } from '~/common/util/urlUtils';
import { resizeBase64ImageIfNeeded } from '~/common/util/imageUtils';

import { _addDBAsset, gcDBAssetsByScope, getDBAsset } from './dblobs.db';
import { _createAssetObject, DBlobAssetId, DBlobAssetType, DBlobDBContextId, DBlobDBScopeId, DBlobImageAsset, DBlobMimeType } from './dblobs.types';


// configuration
const THUMBNAIL_ENCODING_MIMETYPE = !Is.Browser.Safari ? DBlobMimeType.IMG_WEBP : DBlobMimeType.IMG_JPEG;


export async function addDBImageAsset(
  contextId: DBlobDBContextId,
  scopeId: DBlobDBScopeId,
  image: {
    label: string,
    data: DBlobImageAsset['data'],
    origin: DBlobImageAsset['origin'],
    metadata: DBlobImageAsset['metadata'],
  },
): Promise<DBlobAssetId> {
  // create the image asset object
  const imageAsset = _createAssetObject(DBlobAssetType.IMAGE, image.label, image.data, image.origin, image.metadata);

  // add to the DB
  return _addDBImageAsset(imageAsset, contextId, scopeId);
}

async function _addDBImageAsset(imageAsset: DBlobImageAsset, contextId: DBlobDBContextId, scopeId: DBlobDBScopeId): Promise<DBlobAssetId> {

  // Auto-Thumbnail: when adding an image, generate a thumbnail-256 cache level
  if (!imageAsset.cache?.thumb256) {

    // create a thumbnail-256 from the image
    const resizedDataForCache = await resizeBase64ImageIfNeeded(
      imageAsset.data.mimeType,
      imageAsset.data.base64,
      'thumbnail-256',
      THUMBNAIL_ENCODING_MIMETYPE,
      0.9,
    ).catch((error: any) => console.error('addDBAsset: Error resizing image', error));

    // set the cached data
    if (resizedDataForCache) {
      imageAsset.cache.thumb256 = {
        base64: resizedDataForCache.base64,
        mimeType: THUMBNAIL_ENCODING_MIMETYPE,
      };
    }
  }

  // DB add
  return _addDBAsset<typeof imageAsset>(imageAsset, contextId, scopeId);
}


// R

// async function getAllImages() {
//   return await getDBAssetsByType<DBlobImageAsset>(DBlobAssetType.IMAGE);
// }

export async function getImageAsset(id: DBlobAssetId) {
  return await getDBAsset<DBlobImageAsset>(id);
}

export async function getImageAssetAsBlobURL(id: DBlobAssetId) {
  const imageAsset = await getImageAsset(id);
  if (imageAsset)
    return createBlobURLFromData(imageAsset.data.base64, imageAsset.data.mimeType);
  return null;
}

// export async function getImageAssetAsDataURL(id: DBlobAssetId) {
//   const imageAsset = await getImageAsset(id);
//   return imageAsset ? `data:${imageAsset.data.mimeType};base64,${imageAsset.data.base64}` : null;
// }


// U


// D

export async function gcDBImageAssets(contextId: DBlobDBContextId, scopeId: DBlobDBScopeId, keepIds: DBlobAssetId[]) {
  await gcDBAssetsByScope(contextId, scopeId, DBlobAssetType.IMAGE, keepIds);
}
