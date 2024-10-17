import type { DBlobDBContextId, DBlobDBScopeId } from '~/modules/dblobs/dblobs.types';
import { addDBImageAsset } from '~/modules/dblobs/dblobs.images';
import { deleteDBAsset, gcDBAssetsByScope, transferDBAssetContextScope } from '~/modules/dblobs/dblobs.db';

import { convertBase64Image, getImageDimensions, LLMImageResizeMode, resizeBase64ImageIfNeeded } from '~/common/util/imageUtils';
import { createDMessageDataRefDBlob, createImageAttachmentFragment, DMessageAttachmentFragment, isImageRefPart } from '~/common/stores/chat/chat.fragments';

import type { AttachmentDraftSource } from './attachment.types';
import { DEFAULT_ADRAFT_IMAGE_MIMETYPE, DEFAULT_ADRAFT_IMAGE_QUALITY } from './attachment.pipeline';


/**
 * Converts an image input to a DBlob and return a DMessageAttachmentFragment
 */
export async function imageDataToImageAttachmentFragmentViaDBlob(
  mimeType: string,
  inputData: string | ArrayBuffer | unknown,
  source: AttachmentDraftSource,
  title: string,
  caption: string,
  convertToMimeType: false | string,
  resizeMode: false | LLMImageResizeMode,
): Promise<DMessageAttachmentFragment | null> {
  let base64Data: string;
  let inputLength: number;

  if (inputData instanceof ArrayBuffer) {
    // Convert ArrayBuffer to base64
    try {
      const buffer = Buffer.from(inputData);
      base64Data = buffer.toString('base64');
      inputLength = buffer.byteLength;
    } catch (error) {
      console.log('imageAttachment: Error converting ArrayBuffer to base64:', error);
      return null;
    }
  } else if (typeof inputData === 'string') {
    // Assume data is already base64 encoded
    base64Data = inputData;
    inputLength = inputData.length;
  } else {
    console.log('imageAttachment: Invalid input data type:', typeof inputData);
    return null;
  }

  try {
    // Resize image if requested
    if (resizeMode) {
      convertToMimeType = convertToMimeType || DEFAULT_ADRAFT_IMAGE_MIMETYPE;
      const resizedData = await resizeBase64ImageIfNeeded(mimeType, base64Data, resizeMode, convertToMimeType || DEFAULT_ADRAFT_IMAGE_MIMETYPE, DEFAULT_ADRAFT_IMAGE_QUALITY).catch(() => null);
      if (resizedData) {
        base64Data = resizedData.base64;
        mimeType = resizedData.mimeType;
        inputLength = base64Data.length;
      }
    }

    // Convert to default image mimetype if requested
    if (convertToMimeType && mimeType !== convertToMimeType) {
      const convertedData = await convertBase64Image(`data:${mimeType};base64,${base64Data}`, convertToMimeType, DEFAULT_ADRAFT_IMAGE_QUALITY).catch(() => null);
      if (convertedData) {
        base64Data = convertedData.base64;
        mimeType = convertedData.mimeType;
        inputLength = base64Data.length;
      }
    }

    // find out the dimensions (frontend)
    const dimensions = await getImageDimensions(`data:${mimeType};base64,${base64Data}`).catch(() => null);

    // add the image to the DB
    const dblobAssetId = await addDBImageAsset('global', 'attachment-drafts', {
      label: title ? 'Image: ' + title : 'Image',
      data: {
        mimeType: mimeType as any, /* we assume the mime is supported */
        base64: base64Data,
      },
      origin: {
        ot: 'user',
        source: 'attachment',
        media: source.media === 'file' ? source.origin : source.media === 'url' ? 'url' : 'unknown',
        url: source.media === 'url' ? source.url : undefined,
        fileName: source.media === 'file' ? source.refPath : undefined,
      },
      metadata: {
        width: dimensions?.width || 0,
        height: dimensions?.height || 0,
        // description: '',
      },
    });

    // create a data reference for the image
    const imageAssetDataRef = createDMessageDataRefDBlob(dblobAssetId, mimeType, inputLength);

    // return an Image Attachment Fragment
    return createImageAttachmentFragment(title, caption, imageAssetDataRef, undefined, dimensions?.width, dimensions?.height);
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
