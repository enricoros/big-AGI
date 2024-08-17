import { z } from 'zod';


// chat context

export const llmsGenerateContextSchema = z.object({
  method: z.literal('chat-generate'),
  name: z.enum(['chat-ai-title', 'chat-ai-summarize', 'chat-followup-diagram', 'chat-followup-htmlui', 'chat-react-turn', 'draw-expand-prompt']),
  ref: z.string(),
});
export type GenerateContextNameSchema = z.infer<typeof llmsGenerateContextSchema>['name'];

export const llmsStreamingContextSchema = z.object({
  method: z.literal('chat-stream'),
  name: z.enum(['conversation', 'ai-diagram', 'ai-flattener', 'call', 'beam-scatter', 'beam-gather', 'persona-extract']),
  ref: z.string(),
});
export type StreamingContextNameSchema = z.infer<typeof llmsStreamingContextSchema>['name'];


// (non-streaming) Chat Generation Output

export const llmsChatGenerateOutputSchema = z.object({
  role: z.enum(['assistant', 'system', 'user']),
  content: z.string().nullable(),
  finish_reason: z.enum(['stop', 'length']).nullable(),
});

export const llmsChatGenerateWithFunctionsOutputSchema = z.union([
  llmsChatGenerateOutputSchema,
  z.object({
    function_name: z.string(),
    function_arguments: z.record(z.any()),
  }),
]);