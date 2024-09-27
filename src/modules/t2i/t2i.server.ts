import { z } from 'zod';


// Image generation output

const t2iCreateImageOutputSchema = z.object({

  // separate mime and data instead of the data URL 'data:image/png;base64,...'
  mimeType: z.string(),
  base64Data: z.string(),

  // could be the revised prompt, or an alt textual description of the image
  altText: z.string(),

  // metadata
  width: z.number(),
  height: z.number(),

  // origin
  generatorName: z.string(),
  parameters: z.record(z.any()),
  generatedAt: z.string(),

});
export type T2iCreateImageOutput = z.infer<typeof t2iCreateImageOutputSchema>;

export const t2iCreateImagesOutputSchema = z.array(t2iCreateImageOutputSchema);


/**
 * Finds out the mimetype and dimensions of an image from its bytes.
 */
export function getImageInformationFromBytes(arrayBuffer: ArrayBuffer): { width: number; height: number; mimeType: string } {
  const dataView = new DataView(arrayBuffer);

  // Check for PNG signature
  if (dataView.getUint8(0) === 0x89 && dataView.getUint8(1) === 0x50) {
    const dimensions = getPngDimensionsFromBytes(arrayBuffer);
    return { ...dimensions, mimeType: 'image/png' };
  }

  // Check for JPEG signature
  if (dataView.getUint8(0) === 0xFF && dataView.getUint8(1) === 0xD8) {
    const dimensions = getJpegDimensionsFromBytes(arrayBuffer);
    return { ...dimensions, mimeType: 'image/jpeg' };
  }

  throw new Error('Unsupported image format');
}


/**
 * Low-level function to extract the dimensions of a PNG image from its bytes.
 * Used by Prodia to qualify the generated PNG.
 */
export function getPngDimensionsFromBytes(arrayBuffer: ArrayBuffer) {
  const dataView = new DataView(arrayBuffer);

  // Check the PNG signature (first 8 bytes)
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < pngSignature.length; i++) {
    if (dataView.getUint8(i) !== pngSignature[i]) {
      throw new Error('Not a valid PNG file');
    }
  }

  // The IHDR chunk starts at byte 8 after the signature
  const ihdrOffset = 8 + 4; // 8 bytes for signature, 4 bytes for chunk length
  const ihdrType = String.fromCharCode(
    dataView.getUint8(ihdrOffset),
    dataView.getUint8(ihdrOffset + 1),
    dataView.getUint8(ihdrOffset + 2),
    dataView.getUint8(ihdrOffset + 3),
  );

  if (ihdrType !== 'IHDR') {
    throw new Error('IHDR chunk not found');
  }

  // Width is 4 bytes starting from byte 16
  const width = dataView.getUint32(ihdrOffset + 4, false); // Big-endian

  // Height is 4 bytes starting from byte 20
  const height = dataView.getUint32(ihdrOffset + 8, false); // Big-endian

  return { width, height };
}

/**
 * Low-level function to extract the dimensions of a JPEG image from its bytes.
 * Used by the YouTube Transcription module to download and process the thumbnail.
 */
export function getJpegDimensionsFromBytes(arrayBuffer: ArrayBuffer): { width: number; height: number } {
  const dataView = new DataView(arrayBuffer);

  // Check for JPEG signature
  if (dataView.getUint8(0) !== 0xFF || dataView.getUint8(1) !== 0xD8) {
    throw new Error('Not a valid JPEG file');
  }

  let offset = 2;
  while (offset < dataView.byteLength) {
    // Check for the Start Of Frame (SOF) markers
    if (dataView.getUint8(offset) === 0xFF) {
      const marker = dataView.getUint8(offset + 1);

      // SOF markers are in the range 0xC0 - 0xCF, excluding 0xC4, 0xC8, and 0xCC
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        // Height is at offset + 5 (2 bytes)
        const height = dataView.getUint16(offset + 5, false);
        // Width is at offset + 7 (2 bytes)
        const width = dataView.getUint16(offset + 7, false);

        return { width, height };
      } else {
        // Skip this segment
        offset += 2 + dataView.getUint16(offset + 2, false);
      }
    } else {
      throw new Error('Invalid JPEG structure');
    }
  }

  throw new Error('Could not find SOF marker in JPEG');
}
