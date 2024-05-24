import { addDBlobItem } from '~/modules/dblobs/dblobs.db';
import { createDBlobImageItem } from '~/modules/dblobs/dblobs.types';

import { convertBase64Image, getImageDimensions, resizeBase64Image } from '~/common/util/imageUtils';

import type { DAttachmentPart } from '~/common/stores/chat/chat.message';

import type { AttachmentDraftSource } from './attachment.types';

/**
 * Convert an image input to a DBlob and return the DAttachmentPart
 */
export async function attachmentImageToPartViaDBlob(mimeType: string, inputData: string | ArrayBuffer | unknown, source: AttachmentDraftSource, ref: string, title: string, toWebp: boolean, resizeMode: false | 'openai' | 'google' | 'anthropic'): Promise<DAttachmentPart | null> {
  let base64Data: string;
  let inputLength: number;

  if (inputData instanceof ArrayBuffer) {
    // Convert ArrayBuffer to base64
    try {
      const buffer = Buffer.from(inputData);
      base64Data = buffer.toString('base64');
      inputLength = buffer.byteLength;
    } catch (error) {
      console.log('attachmentImageToPartViaDBlob: Issue converting ArrayBuffer', error);
      return null;
    }
  } else if (typeof inputData === 'string') {
    // Assume data is already base64 encoded
    base64Data = inputData;
    inputLength = inputData.length;
  } else {
    console.log('attachmentImageToPartViaDBlob: Expected ArrayBuffer or base64, got:', typeof inputData);
    return null;
  }

  try {
    // Resize image if requested
    if (resizeMode) {
      const resizedData = await resizeBase64Image(`data:${mimeType};base64,${base64Data}`, resizeMode, 'image/webp', 0.90).catch(() => null);
      if (resizedData) {
        base64Data = resizedData.base64;
        mimeType = resizedData.mimeType;
        inputLength = base64Data.length;
      }
    }

    // Convert to WebP if requested
    if (toWebp && mimeType !== 'image/webp') {
      const webpData = await convertBase64Image(`data:${mimeType};base64,${base64Data}`, 'image/webp', 0.90).catch(() => null);
      if (webpData) {
        base64Data = webpData.base64;
        mimeType = webpData.mimeType;
        inputLength = base64Data.length;
      }
    }

    // find out the dimensions (frontend)
    const dimensions = await getImageDimensions(`data:${mimeType};base64,${base64Data}`).catch(() => null);

    // Create DBlob image item
    const dblobImageItem = createDBlobImageItem(
      ref ? 'Image: ' + ref : 'Image',
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

    // Create Part
    return {
      atype: 'aimage',
      source: {
        reftype: 'dblob',
        dblobId: dblobId,
        mimeType: mimeType,
        bytesSize: inputLength,
      },
      title: title,
      width: dimensions?.width,
      height: dimensions?.height,
      collapsible: false,
    } satisfies DAttachmentPart;
  } catch (error) {
    console.error('Error storing image in DBlobs:', error);
    return null;
  }
}