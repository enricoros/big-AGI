import { z } from 'zod';

import { anthropicAccessSchema } from '~/modules/llms/server/anthropic/anthropic.router';
import { geminiAccessSchema } from '~/modules/llms/server/gemini/gemini.router';
import { ollamaAccessSchema } from '~/modules/llms/server/ollama/ollama.router';
import { openAIAccessSchema } from '~/modules/llms/server/openai/openai.router';

import { intake_ChatMessage_schema, intake_SystemMessage_schema } from './schemas.intake.messages';
import { intake_ToolDefinition_schema, intake_ToolsPolicy_schema } from './schemas.intake.tools';


// Export types
export type Intake_Access = z.infer<typeof intake_Access_schema>;
export type Intake_Model = z.infer<typeof intake_Model_schema>;
export type Intake_ChatGenerateRequest = z.infer<typeof intake_ChatGenerateRequest_schema>;
export type Intake_ContextChatStream = z.infer<typeof intake_ContextChatStream_schema>;


// Intake Access Schema

export const intake_Access_schema = z.discriminatedUnion(
  'dialect',
  [
    anthropicAccessSchema,
    geminiAccessSchema,
    ollamaAccessSchema,
    openAIAccessSchema,
  ],
);


// Intake Model Schema

export const intake_Model_schema = z.object({
  id: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(1000000).optional(),
});


// Intake Content Generation Schema

export const intake_ChatGenerateRequest_schema = z.object({
  systemMessage: intake_SystemMessage_schema.optional(),
  chatSequence: z.array(intake_ChatMessage_schema),
  tools: z.array(intake_ToolDefinition_schema).optional(),
  toolsPolicy: intake_ToolsPolicy_schema.optional(),
});


// Intake Context (Streaming) Schema

export const intake_ContextChatStream_schema = z.object({
  method: z.literal('chat-stream'),
  name: z.enum(['conversation', 'ai-diagram', 'ai-flattener', 'call', 'beam-scatter', 'beam-gather', 'persona-extract']),
  ref: z.string(),
});
