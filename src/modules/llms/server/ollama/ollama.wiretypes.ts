import { z } from 'zod';


/*const wireOllamaModelDetailsSchema = z.object({
  parent_model: z.string().optional(),
  format: z.string().optional(),                      // e.g. gguf
  family: z.string().optional(),                      // e.g. llama, phi2, stablelm
  families: z.array(z.string()).nullable().optional(),// e.g. null, [llama], [phi2]
  parameter_size: z.string().optional(),              // e.g. 7B, 3B, 34B, 6B, 30B
  quantization_level: z.string().optional(),          // e.g. Q4_0, Q8_0, F16, ...
}).optional();*/

/**
 * List Local Models (/api/tags) - Response
 */
export const wireOllamaListModelsSchema = z.object({
  models: z.array(z.object({
    name: z.string(),
    modified_at: z.string(),
    size: z.number(),
    // digest: z.string(),
    // details: wireOllamaModelDetailsSchema.optional(),
  })),
});

/**
 * Show per-Model Information (/api/show) - Response
 */
export const wireOllamaModelInfoSchema = z.object({
  license: z.string().optional(),
  modelfile: z.string(),
  parameters: z.string().optional(),
  template: z.string().optional(),
  // details: wireOllamaModelDetailsSchema.optional(),
});


/**
 * Chat Completion API - Request
 * https://github.com/jmorganca/ollama/blob/main/docs/api.md#generate-a-chat-completion
 */
// const wireOllamaChatCompletionInputSchema = z.object({
//
//   // required
//   model: z.string(),
//   messages: z.array(z.object({
//     role: z.enum(['system', 'user', 'assistant']),
//     content: z.string(),
//     images: z.array(z.string()).optional(), // base64 encoded images
//   })),
//
//   // optional
//   format: z.enum(['json']).optional(),
//   options: z.object({
//     // https://github.com/ollama/ollama/blob/main/docs/modelfile.md
//     // Maximum number of tokens to predict when generating text.
//     num_predict: z.number().int().optional(),
//     // Sets the random number seed to use for generation
//     seed: z.number().int().optional(),
//     // The temperature of the model
//     temperature: z.number().positive().optional(),
//     // Reduces the probability of generating nonsense (Default: 40)
//     top_k: z.number().positive().optional(),
//     // Works together with top-k. A higher value (e.g., 0.95) will lead to more diverse text. (Default 0.9)
//     top_p: z.number().positive().optional(),
//   }).optional(),
//   stream: z.boolean().optional(), // default: true
//   keep_alive: z.string().optional(), // e.g. '5m'
//
//   // Note: not used anymore as of 2024-05-07?
//   // template: z.string().optional(), // overrides what is defined in the Modelfile
//
//   // Future Improvements?
//   // n: z.number().int().optional(), // number of completions to generate
//   // functions: ...
//   // function_call: ...
// });
//export type WireOllamaChatCompletionInput = z.infer<typeof wireOllamaChatCompletionInputSchema>;


/**
 * Chat Completion or Generation APIs - Streaming Response
 */
// export const wireOllamaChunkedOutputSchema = z.union([
//   // Chat Completion Chunk
//   z.object({
//     model: z.string(),
//     // created_at: z.string(), // commented because unused
//
//     // [Chat Completion] (exclusive with 'response')
//     message: z.object({
//       role: z.enum(['assistant' /*, 'system', 'user' Disabled on purpose, to validate the response */]),
//       content: z.string(),
//     }).optional(), // optional on the last message
//
//     // [Generation] (non-chat, exclusive with 'message')
//     //response: z.string().optional(),
//
//     done: z.boolean(),
//
//     // only on the last message
//     // context: z.array(z.number()), // non-chat endpoint
//     // total_duration: z.number(),
//     prompt_eval_count: z.number().optional(),
//     // prompt_eval_duration: z.number(),
//     eval_count: z.number().optional(),
//     eval_duration: z.number().optional(),
//
//   }),
//   // Possible Error
//   z.object({
//     error: z.string(),
//   }),
// ]);