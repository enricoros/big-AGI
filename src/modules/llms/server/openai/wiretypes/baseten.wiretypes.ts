import * as z from 'zod/v4';


// [Baseten, 2026-08-28] Shape of https://inference.baseten.co/v1/models (Model APIs, 15 entries).
// Only `id` is structurally required - everything else is read opportunistically, so a field the
// catalog drops later can never zero the whole service (see llmapi.wiretypes.ts for the history).
const _wireBasetenModelSchema = z.object({
  id: z.string(),                             // 'zai-org/GLM-5.3-Flash' - creator/model, passed verbatim as the request `model`
  created: z.number().nullish(),              // catalog listing date, not the model release (pubDate is curated instead)
  name: z.string().nullish(),                 // display name, e.g. 'GLM 5.3 Flash'
  description: z.string().nullish(),          // empty string on some rows
  context_length: z.number().nullish(),
  max_completion_tokens: z.number().nullish(),
  quantization: z.string().nullish(),         // 'fp4' | 'fp8' today

  // dollars-per-token strings, e.g. "0.0000006"; image/request are "0" on every row today
  pricing: z.object({
    prompt: z.string().nullish(),
    completion: z.string().nullish(),
    input_cache_read: z.string().nullish(),   // automatic prefix caching
  }).nullish(),

  // supported_sampling_parameters: temperature always; stop/top_p/top_k vary - unused here
  supported_features: z.array(z.string()).nullish(), // 'tools' | 'reasoning' | 'json_mode' | 'structured_outputs' | 'reasoning_effort'
  input_modalities: z.array(z.string()).nullish(),   // 'text' | 'image'
  output_modalities: z.array(z.string()).nullish(),  // 'text' on every row today
});


export type WireBasetenModel = z.infer<typeof _wireBasetenModelSchema>;
export const wireBasetenListOutputSchema = z.object({
  data: z.array(_wireBasetenModelSchema),
});
