import { addDBlobItem, deleteDBlobItem } from '~/modules/dblobs/dblobs.db';
import { createDBlobImageItem } from '~/modules/dblobs/dblobs.types';

import { convertBase64Image, getImageDimensions, LLMImageResizeMode, resizeBase64ImageIfNeeded } from '~/common/util/imageUtils';

import { createDMessageDataRefDBlob, createImageAttachmentFragment, DMessageAttachmentFragment } from '~/common/stores/chat/chat.message';

import type { AttachmentDraftSource } from './attachment.types';
import { DEFAULT_ADRAFT_IMAGE_MIMETYPE, DEFAULT_ADRAFT_IMAGE_QUALITY } from './attachment.pipeline';


/**
 * Convert an image input to a DBlob and return a DMessageAttachmentFragment
 */
export async function attachmentImageToFragmentViaDBlob(mimeType: string, inputData: string | ArrayBuffer | unknown, source: AttachmentDraftSource, title: string, altText: string, convertToMimeType: false | string, resizeMode: false | LLMImageResizeMode): Promise<DMessageAttachmentFragment | null> {
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

    // Create DBlob image item
    const dblobImageItem = createDBlobImageItem(
      title ? 'Image: ' + title : 'Image',
      {
        mimeType: mimeType as any, /* we assume the mime is supported */
        base64: base64Data,
      },
      {
        origin: 'user', source: 'attachment',
        media: source.media === 'file' ? source.origin : source.media === 'url' ? 'url' : 'unknown',
        url: source.media === 'url' ? source.url : undefined,
        fileName: source.media === 'file' ? source.refPath : undefined,
      },
      {
        width: dimensions?.width || 0,
        height: dimensions?.height || 0,
        // description: '',
      },
    );

    // Add to DBlobs database
    const dblobId = await addDBlobItem(dblobImageItem, 'global', 'attachments');

    // return the DMessageAttachmentFragment
    const imagePartDataRef = createDMessageDataRefDBlob(dblobId, mimeType, inputLength);
    return createImageAttachmentFragment(title, imagePartDataRef, altText, dimensions?.width, dimensions?.height);
  } catch (error) {
    console.error('imageAttachment: Error processing image:', error);
    return null;
  }
}

/**
 * Remove the DBlob item associated with the given DMessageAttachmentFragment
 */
export async function removeDBlobItemFromAttachmentFragment(fragment: DMessageAttachmentFragment) {
  if (fragment.part.pt === 'image_ref' && fragment.part.dataRef.reftype === 'dblob') {
    await deleteDBlobItem(fragment.part.dataRef.dblobId);
  }
}
