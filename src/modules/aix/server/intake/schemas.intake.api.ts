import { z } from 'zod';

import { anthropicAccessSchema } from '~/modules/llms/server/anthropic/anthropic.router';
import { geminiAccessSchema } from '~/modules/llms/server/gemini/gemini.router';
import { ollamaAccessSchema } from '~/modules/llms/server/ollama/ollama.router';
import { openAIAccessSchema } from '~/modules/llms/server/openai/openai.router';

import { intake_ChatMessage_Schema, intake_SystemMessage_Schema } from './schemas.intake.messages';
import { intake_ToolDefinition_Schema, intake_ToolsPolicy_Schema } from './schemas.intake.tools';


// Export types
export type Intake_Access = z.infer<typeof intake_Access_Schema>;
export type Intake_Model = z.infer<typeof intake_Model_Schema>;
export type Intake_ChatGenerateRequest = z.infer<typeof intake_ChatGenerateRequest_Schema>;
export type Intake_ContextChatStream = z.infer<typeof intake_ContextChatStream_Schema>;


// Intake Access Schema

export const intake_Access_Schema = z.discriminatedUnion(
  'dialect',
  [
    anthropicAccessSchema,
    geminiAccessSchema,
    ollamaAccessSchema,
    openAIAccessSchema,
  ],
);


// Intake Model Schema

export const intake_Model_Schema = z.object({
  id: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(1000000).optional(),
});


// Intake Content Generation Schema

export const intake_ChatGenerateRequest_Schema = z.object({
  systemMessage: intake_SystemMessage_Schema.optional(),
  chatSequence: z.array(intake_ChatMessage_Schema),
  tools: z.array(intake_ToolDefinition_Schema).optional(),
  toolsPolicy: intake_ToolsPolicy_Schema.optional(),
});


// Intake Context (Streaming) Schema

export const intake_ContextChatStream_Schema = z.object({
  method: z.literal('chat-stream'),
  name: z.enum(['conversation', 'ai-diagram', 'ai-flattener', 'call', 'beam-scatter', 'beam-gather', 'persona-extract']),
  ref: z.string(),
});
