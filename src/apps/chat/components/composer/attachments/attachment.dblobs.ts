import { addDBlobItem } from '~/modules/dblobs/dblobs.db';
import { createDBlobImageItem } from '~/modules/dblobs/dblobs.types';

import type { DAttachmentPart } from '~/common/stores/chat/chat.message';
import { convertBase64Image, getImageDimensions } from '~/common/util/imageUtils';

import type { AttachmentInput, AttachmentSource } from './attachment.types';


/**
 * Convert an image attachment to a DBlob and return the DAttachmentPart
 */
export async function imageDataToOutputsViaDBlobs(_input: AttachmentInput, source: AttachmentSource, ref: string, title: string, toWebp: boolean): Promise<DAttachmentPart | null> {
  if (!(_input.data instanceof ArrayBuffer)) {
    console.log('Expected ArrayBuffer for Image, got:', typeof _input.data);
    return null;
  }

  try {
    // get image data
    const buffer = Buffer.from(_input.data);
    let base64Data = buffer.toString('base64');
    let mimeType = _input.mimeType;

    // Convert to WebP if requested
    if (toWebp) {
      const webpData = await convertBase64Image(`data:${mimeType};base64,${base64Data}`, 'image/webp').catch(() => null);
      if (webpData) {
        base64Data = webpData.base64;
        mimeType = webpData.mimeType;
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

    // Create output
    return {
      atype: 'aimage',
      source: {
        reftype: 'dblob',
        dblobId: dblobId,
        mimeType: mimeType,
        bytesSize: _input.data.byteLength,
      },
      title: title,
      width: dimensions?.width,
      height: dimensions?.height,
      collapsible: false,
    };
  } catch (error) {
    console.error('Error storing image in DBlobs:', error);
    return null;
  }
}