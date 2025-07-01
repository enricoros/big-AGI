import { Is } from '~/common/util/pwaUtils';
import { convert_Base64WithMimeType_To_Blob, convert_Blob_To_Base64 } from '~/common/util/blobUtils';
import { imageBlobResizeIfNeeded } from '~/common/util/imageUtils';

import { _addDBAsset, gcDBAssetsByScope, getDBAsset } from './dblobs.db';
import { _createAssetObject, DBlobAssetId, DBlobAssetType, DBlobDBContextId, DBlobDBScopeId, DBlobImageAsset, DBlobMimeType } from './dblobs.types';


// configuration
const THUMBNAIL_ENCODING_MIMETYPE = !Is.Browser.Safari ? DBlobMimeType.IMG_WEBP : DBlobMimeType.IMG_JPEG;
const THUMBNAIL_ENCODING_LOSSY_QUALITY = 0.9; // 90% quality for JPEG/WEBP thumbnails


export async function addDBImageAsset(
  scopeId: DBlobDBScopeId,
  imageBlob: Blob,
  image: {
    label: string,
    origin: DBlobImageAsset['origin'],
    metadata: DBlobImageAsset['metadata'],
  },
): Promise<DBlobAssetId> {

  // Blob -> base64
  const base64Data = await convert_Blob_To_Base64(imageBlob, 'addDBImageAsset');
  const imageType = imageBlob.type; // We assume the mime type is supported

  const assetData: DBlobImageAsset['data'] = {
    base64: base64Data,
    mimeType: imageType as any,
  };

  // create the image asset object
  const imageAsset = _createAssetObject(
    DBlobAssetType.IMAGE,
    image.label,
    assetData,
    image.origin,
    image.metadata,
  );


  // Auto-Thumbnail: when adding an image, generate a thumbnail-256 cache level
  if (!imageAsset.cache?.thumb256) {
    try {
      // create a thumbnail-256 from the image
      const resizedDataForCache = await imageBlobResizeIfNeeded(
        imageBlob,
        'thumbnail-256',
        THUMBNAIL_ENCODING_MIMETYPE,
        THUMBNAIL_ENCODING_LOSSY_QUALITY,
      );

      // set the cached data
      if (resizedDataForCache) {
        const thumbBase64Data = await convert_Blob_To_Base64(resizedDataForCache.blob, 'addDBImageAsset.thumb256');
        imageAsset.cache = {
          ...imageAsset.cache, // ensure we don't overwrite existing cache levels
          thumb256: {
            base64: thumbBase64Data,
            mimeType: THUMBNAIL_ENCODING_MIMETYPE,
          },
        };
      }

    } catch (thumbnailError) {
      console.warn('[DEV] addDBImageAsset: Error creating thumbnail-256', thumbnailError);
      // ignore error, this is not critical
    }
  }

  // DB add
  return _addDBAsset<typeof imageAsset>(imageAsset, 'global', scopeId);
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
  if (!imageAsset) return null;
  try {
    const imageBlob = await convert_Base64WithMimeType_To_Blob(imageAsset.data.base64, imageAsset.data.mimeType, 'getImageAssetAsBlobURL');
    return URL.createObjectURL(imageBlob);
  } catch (error) {
    console.warn('[DEV] getImageAssetAsBlobURL: Failed to convert image data to Blob.', error);
    return null;
  }
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
