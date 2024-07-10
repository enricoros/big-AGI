import { z } from 'zod';

import { anthropicAccessSchema } from '~/modules/llms/server/anthropic/anthropic.router';
import { geminiAccessSchema } from '~/modules/llms/server/gemini/gemini.router';
import { ollamaAccessSchema } from '~/modules/llms/server/ollama/ollama.router';
import { openAIAccessSchema } from '~/modules/llms/server/openai/openai.router';

import { aixChatMessageSchema, aixSystemMessageSchema } from './schemas.aix.parts';
import { aixToolsPolicySchema, aixToolsSchema } from './schemas.aix.tools';


// Export types
// export type AixAccess = z.infer<typeof aixAccessSchema>;
// export type AixModel = z.infer<typeof aixModelSchema>;
// export type AixContentGeneration = z.infer<typeof aixContentGenerationSchema>;
// export type AixStreamingContext = z.infer<typeof aixStreamingContextSchema>;


// AIX Access Schema

export const aixAccessSchema = z.discriminatedUnion(
  'dialect',
  [
    anthropicAccessSchema,
    geminiAccessSchema,
    ollamaAccessSchema,
    openAIAccessSchema,
  ],
);


// AIX Model Schema

export const aixModelSchema = z.object({
  id: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(1000000).optional(),
});


// AIX Content Generation Schema

export const aixChatContentGenerateSchema = z.object({
  systemMessage: aixSystemMessageSchema.optional(),
  inputSequence: z.array(aixChatMessageSchema),
  tools: z.array(aixToolsSchema).optional(),
  toolPolicy: aixToolsPolicySchema.optional(),
});


// AIX Context (Streaming) Schema

export const aixStreamingContextSchema = z.object({
  method: z.literal('chat-stream'),
  name: z.enum(['conversation', 'ai-diagram', 'ai-flattener', 'call', 'beam-scatter', 'beam-gather', 'persona-extract']),
  ref: z.string(),
});
