import { z } from 'zod';


// Image generation output

export const t2iCreateImageOutputSchema = z.object({

  // one of these two will be present
  imageUrl: z.string().optional(),
  base64ImageDataUrl: z.string().optional(),

  // could be the revised prompt, or an alt textual description of the image
  altText: z.string(),

  // optional
  elapsed: z.number().optional(),

});