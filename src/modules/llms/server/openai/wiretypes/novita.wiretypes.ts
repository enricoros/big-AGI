import * as z from 'zod/v4';


// [Novita] Models List API - Response
// Based on https://api.novita.ai/openai/v1/models

// prices in hundredths of a cent per 1M tokens, like the flat *_price_per_m fields
const _wireNovitaPricesSchema = z.object({
  prompt: z.object({ price_per_m: z.number().optional() }).optional(),
  completion: z.object({ price_per_m: z.number().optional() }).optional(),
  input_cache_read: z.object({ price_per_m: z.number().optional() }).optional(),
});

export const wireNovitaModelSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  created: z.number(),
  owned_by: z.string().optional(),

  // Novita-specific fields
  display_name: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  context_size: z.number().optional(),
  max_output_tokens: z.number().optional(),
  input_token_price_per_m: z.number().optional(),
  output_token_price_per_m: z.number().optional(),
  pricing: _wireNovitaPricesSchema.optional(),
  is_tiered_billing: z.boolean().optional(),
  tiered_billing_configs: z.array(z.object({ // input-length tiers; the flat fields hold the first
    max_tokens: z.number().optional(),
    pricing: _wireNovitaPricesSchema.optional(),
  })).optional(),
  model_type: z.string().optional(), // "chat"
  status: z.number().optional(),

  // Capabilities
  features: z.array(z.string()).optional(), // ["serverless", "function-calling", "reasoning", "structured-outputs"]
  endpoints: z.array(z.string()).optional(), // ["chat/completions", "completions", "anthropic"]
  input_modalities: z.array(z.string()).optional(), // ["text", "image", "video", "audio"]
  output_modalities: z.array(z.string()).optional(), // ["text", "audio"]

  // Optional fields from standard OpenAI-compatible response
  root: z.string().optional(),
  parent: z.string().optional(),
  permission: z.any().optional(),
  tags: z.array(z.string()).optional(),
});

export const wireNovitaListOutputSchema = z.object({
  data: z.array(wireNovitaModelSchema),
});

export type WireNovitaModel = z.infer<typeof wireNovitaModelSchema>;
