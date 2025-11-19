import * as z from 'zod/v4';


export const wireLocalAIModelsAvailableOutputSchema = z.array(z.object({
  // core identifier
  name: z.string()
    .optional(), // one model missed it

  // Descriptive fields
  url: z.string().optional(), // Missing in some entries
  description: z.string().optional(),
  icon: z.string().optional(),
  license: z.string().optional(),
  tags: z.array(z.string()).optional(),

  // Links and file information
  urls: z.array(z.string()).optional(),
  files: z.array(z.object({
    filename: z.string(),          // voice-en-us-amy-low.tar.gz
    uri: z.string(),               // https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-amy-low.tar.gz
    sha256: z.string().optional(), // often empty
  })).optional(),

  // Metadata
  gallery: z.object({
    url: z.string(),
    name: z.string(),
  }),

  installed: z.boolean().optional(),
}));

// --- Preserved Schemas from Your Original File ---

export const wireLocalAIModelsApplyOutputSchema = z.object({
  uuid: z.string(),
  status: z.string(),
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

// --- Inferred TypeScript Types for Type-Safe Usage ---

// export type ModelFile = z.infer<typeof ModelFileSchema>;
// export type ModelGallery = z.infer<typeof ModelGallerySchema>;
// export type Model = z.infer<typeof ModelSchema>;
// export type AvailableModels = z.infer<typeof wireLocalAIModelsAvailableOutputSchema>;
// export type ApplyModelOutput = z.infer<typeof wireLocalAIModelsApplyOutputSchema>;
// export type ListModelsOutput = z.infer<typeof wireLocalAIModelsListOutputSchema>;
