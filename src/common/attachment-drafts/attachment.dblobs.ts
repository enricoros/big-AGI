import { addDBImageAsset, DBlobDBContextId, DBlobDBScopeId, deleteDBAsset, gcDBAssetsByScope, transferDBAssetContextScope } from '~/common/stores/blob/dblobs-portability';

import { CommonImageMimeTypes, imageBlobTransform, LLMImageResizeMode } from '~/common/util/imageUtils';
import { convert_Base64WithMimeType_To_Blob } from '~/common/util/blobUtils';
import { createDMessageDataRefDBlob, createImageAttachmentFragment, DMessageAttachmentFragment, isImageRefPart } from '~/common/stores/chat/chat.fragments';

import type { AttachmentDraftSource } from './attachment.types';


/**
 * Converts an image input to a DBlob and return a DMessageAttachmentFragment
 */
export async function imageDataToImageAttachmentFragmentViaDBlob(
  inputMime: string,
  inputData: string | Blob | unknown,
  source: AttachmentDraftSource,
  title: string,
  caption: string,
  convertToMimeType: false | CommonImageMimeTypes,
  resizeMode: false | LLMImageResizeMode,
): Promise<DMessageAttachmentFragment | null> {

  // convert to Blobs if needed
  let inputImage: Blob;
  if (inputData instanceof Blob) {
    inputImage = inputData;
  } else if (typeof inputData === 'string') {
    try {
      inputImage = await convert_Base64WithMimeType_To_Blob(inputData, inputMime, 'image-attachment');
    } catch (conversionError) {
      console.warn(`[DEV] imageAttachment: Error converting string to Blob:`, { conversionError });
      return null;
    }
  } else {
    console.log('imageAttachment: Invalid input data type:', typeof inputData);
    return null;
  }

  try {

    // perform resize/type conversion if desired, and find the image dimensions
    const { blob: imageBlob, height: imageHeight, width: imageWidth } = await imageBlobTransform(inputImage, {
      resizeMode: resizeMode || undefined,
      convertToMimeType: convertToMimeType || undefined,
      convertToLossyQuality: undefined, // use default
      throwOnResizeError: true,
      throwOnTypeConversionError: true,
    });

    // add the image to the DBlobs DB
    const dblobAssetId = await addDBImageAsset('attachment-drafts', imageBlob, {
      label: title ? 'Image: ' + title : 'Image',
      metadata: {
        width: imageWidth,
        height: imageHeight,
        // description: '',
      },
      origin: { // User originated
        ot: 'user',
        source: 'attachment',
        media: source.media === 'file' ? source.origin : source.media === 'url' ? 'url' : 'unknown',
        url: source.media === 'url' ? source.url : undefined,
        fileName: source.media === 'file' ? source.refPath : undefined,
      },
    });

    // return an Image _Attachment_ Fragment
    return createImageAttachmentFragment(
      title,
      caption,
      createDMessageDataRefDBlob( // Data Reference {} for the image
        dblobAssetId,
        imageBlob.type,
        imageBlob.size,
      ),
      undefined,
      imageWidth || undefined,
      imageHeight || undefined,
    );
  } catch (error) {
    console.error('imageAttachment: Error processing image:', error);
    return null;
  }
}

/**
 * Remove the DBlob item associated with the given DMessageAttachmentFragment
 */
export async function removeAttachmentOwnedDBAsset({ part }: DMessageAttachmentFragment) {
  if (isImageRefPart(part) && part.dataRef.reftype === 'dblob') {
    await deleteDBAsset(part.dataRef.dblobAssetId);
  }
}

/**
 * Move the DBlob items associated with the given DMessageAttachmentFragment to a new context and scope
 */
export async function transferAttachmentOwnedDBAsset({ part }: DMessageAttachmentFragment, contextId: DBlobDBContextId, scopeId: DBlobDBScopeId) {
  if (isImageRefPart(part) && part.dataRef.reftype === 'dblob') {
    await transferDBAssetContextScope(part.dataRef.dblobAssetId, contextId, scopeId);
  }
}

/**
 * GC Functions for Attachment DBlobs systems: remove leftover drafts
 */
export async function gcAttachmentDBlobs() {
  // wipe all objects related to attachment drafts that could have been there from previous sessions
  await gcDBAssetsByScope('global', 'attachment-drafts', null, []);
}
