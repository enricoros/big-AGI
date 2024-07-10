import { z } from 'zod';

import { anthropicAccessSchema } from '~/modules/llms/server/anthropic/anthropic.router';
import { geminiAccessSchema } from '~/modules/llms/server/gemini/gemini.router';
import { ollamaAccessSchema } from '~/modules/llms/server/ollama/ollama.router';
import { openAIAccessSchema } from '~/modules/llms/server/openai/openai.router';


// AIX Access Schema //

export type AixAccess = z.infer<typeof aixAccessSchema>;

export const aixAccessSchema = z.discriminatedUnion(
  'dialect',
  [
    anthropicAccessSchema,
    geminiAccessSchema,
    ollamaAccessSchema,
    openAIAccessSchema,
  ],
);


// AIX Model Schema //

export type AixModel = z.infer<typeof aixModelSchema>;

// FIXME: have a more flexible schema
export const aixModelSchema = z.object({
  id: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(1000000).optional(),
});


// AIX History Schema //

export type AixHistory = z.infer<typeof aixHistorySchema>;

export const aixHistorySchema = z.array(z.object({
  role: z.enum(['assistant', 'system', 'user'/*, 'function'*/]),
  content: z.string(),
}));


// AIX Context Schema //

export type AixStreamGenerateContext = z.infer<typeof aixStreamingContextSchema>;

export const aixStreamingContextSchema = z.object({
  method: z.literal('chat-stream'),
  name: z.enum(['conversation', 'ai-diagram', 'ai-flattener', 'call', 'beam-scatter', 'beam-gather', 'persona-extract']),
  ref: z.string(),
});

