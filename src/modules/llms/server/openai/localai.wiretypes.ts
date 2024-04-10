import { z } from 'zod';


export const wireLocalAIModelsAvailableOutputSchema = z.array(z.object({
  name: z.string(),       // (e.g.) tinydream
  url: z.string(),        // (e.g.) github:go-skynet/model-gallery/tinydream.yaml
  license: z.string().optional(),    // (e.g.) other
  gallery: z.object({
    url: z.string(),      // (e.g.) github:go-skynet/model-gallery/index.yaml
    name: z.string(),     // (e.g.) model-gallery
  }),
  urls: z.array(z.string()).optional(),
  files: z.array(z.object({
    filename: z.string(),          // voice-en-us-amy-low.tar.gz
    uri: z.string(),               // https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-amy-low.tar.gz
    sha256: z.string().optional(), // often empty
  })).optional(),
})).nullable(); // null if galleries are not served

export const wilreLocalAIModelsApplyOutputSchema = z.object({
  uuid: z.string().uuid(),
  status: z.string().url(),
});

export const wireLocalAIModelsListOutputSchema = z.object({
  file_name: z.string(),
  error: z.string().nullable(),
  processed: z.boolean(),
  message: z.string().nullable(),
  progress: z.number(),
  file_size: z.string(),
  downloaded_size: z.string(),
});