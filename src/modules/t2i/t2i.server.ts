import { z } from 'zod';


// Image generation output

const t2iCreateImageOutputSchema = z.object({

  // the image data plus mime, as image URL, such as 'data:image/png;base64,...'
  base64ImageDataUrl: z.string(),

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


export function getPngDimensions(arrayBuffer: ArrayBuffer) {
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