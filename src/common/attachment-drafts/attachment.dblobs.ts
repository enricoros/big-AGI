import { addDBImageAsset, DBlobDBContextId, DBlobDBScopeId, deleteDBAsset, gcDBAssetsByScope, transferDBAssetContextScope } from '~/common/stores/blob/dblobs-portability';
import { nanoidToUuidV4 } from '~/common/util/idUtils';

import { CommonImageMimeTypes, imageBlobTransform, LLMImageResizeMode } from '~/common/util/imageUtils';
import { convert_Base64WithMimeType_To_Blob } from '~/common/util/blobUtils';
import { DMessageAttachmentFragment, createDMessageDataRefDBlob, createZyncAssetReferenceAttachmentFragment, isImageRefPart, isZyncAssetImageReferencePartWithLegacyDBlob, isZyncAssetReferencePart } from '~/common/stores/chat/chat.fragments';

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

    // Future-proof: create a Zync Image Asset reference attachment fragment, with the legacy image_ref part for compatibility for the time being
    return createZyncAssetReferenceAttachmentFragment(
      title, caption,
      nanoidToUuidV4(dblobAssetId, 'convert-dblob-to-dasset'),
      title || (source.media === 'file' ? source.refPath : source.media === 'url' ? source.refUrl : undefined), // use title if available, otherwise use the source refPath or refUrl
      'image',
      {
        pt: 'image_ref' as const,
        dataRef: createDMessageDataRefDBlob(dblobAssetId, imageBlob.type, imageBlob.size),
        ...(title ? { altText: title } : {}),
        ...(imageWidth ? { width: imageWidth } : {}),
        ...(imageHeight ? { height: imageHeight } : {}),
      }
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
  if (isZyncAssetImageReferencePartWithLegacyDBlob(part) && part._legacyImageRefPart?.dataRef.reftype === 'dblob')
    await deleteDBAsset(part._legacyImageRefPart.dataRef.dblobAssetId);
  else if (isImageRefPart(part) && part.dataRef.reftype === 'dblob')
    await deleteDBAsset(part.dataRef.dblobAssetId);
}

/**
 * Move the DBlob items associated with the given DMessageAttachmentFragment to a new context and scope
 */
export async function transferAttachmentOwnedDBAsset({ part }: DMessageAttachmentFragment, contextId: DBlobDBContextId, scopeId: DBlobDBScopeId) {
  if (isZyncAssetReferencePart(part) && part._legacyImageRefPart?.dataRef.reftype === 'dblob')
    await transferDBAssetContextScope(part._legacyImageRefPart.dataRef.dblobAssetId, contextId, scopeId);
  else if (isImageRefPart(part) && part.dataRef.reftype === 'dblob')
    await transferDBAssetContextScope(part.dataRef.dblobAssetId, contextId, scopeId);
}

/**
 * GC Functions for Attachment DBlobs systems: remove leftover drafts
 */
export async function gcAttachmentDBlobs() {
  // wipe all objects related to attachment drafts that could have been there from previous sessions
  await gcDBAssetsByScope('global', 'attachment-drafts', null, []);
}
