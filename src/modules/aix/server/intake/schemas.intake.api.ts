import { z } from 'zod';

import { anthropicAccessSchema } from '~/modules/llms/server/anthropic/anthropic.router';
import { geminiAccessSchema } from '~/modules/llms/server/gemini/gemini.router';
import { ollamaAccessSchema } from '~/modules/llms/server/ollama/ollama.router';
import { openAIAccessSchema } from '~/modules/llms/server/openai/openai.router';

import { intakeChatMessageSchema, intakeSystemMessageSchema } from './schemas.intake.parts';
import { intakeToolDefinitionSchema, intakeToolsPolicySchema } from './schemas.intake.tools';


// Export types
export type IntakeAccess = z.infer<typeof intakeAccessSchema>;
export type IntakeModel = z.infer<typeof intakeModelSchema>;
export type IntakeChatGenerateRequest = z.infer<typeof intakeChatGenerateRequestSchema>;
export type IntakeContextChatStream = z.infer<typeof intakeContextChatStreamSchema>;


// Intake Access Schema

export const intakeAccessSchema = z.discriminatedUnion(
  'dialect',
  [
    anthropicAccessSchema,
    geminiAccessSchema,
    ollamaAccessSchema,
    openAIAccessSchema,
  ],
);


// Intake Model Schema

export const intakeModelSchema = z.object({
  id: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(1000000).optional(),
});


// Intake Content Generation Schema

export const intakeChatGenerateRequestSchema = z.object({
  systemMessage: intakeSystemMessageSchema.optional(),
  chat: z.array(intakeChatMessageSchema),
  tools: z.array(intakeToolDefinitionSchema).optional(),
  toolsPolicy: intakeToolsPolicySchema.optional(),
});


// Intake Context (Streaming) Schema

export const intakeContextChatStreamSchema = z.object({
  method: z.literal('chat-stream'),
  name: z.enum(['conversation', 'ai-diagram', 'ai-flattener', 'call', 'beam-scatter', 'beam-gather', 'persona-extract']),
  ref: z.string(),
});
