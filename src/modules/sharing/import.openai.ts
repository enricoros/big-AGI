import { TRPCError } from '@trpc/server';
import { z } from 'zod';


// OpenAI shared chat - wire

const openaiMessageSchema = z.object({
  id: z.string(),
  author: z.object({
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    metadata: z.record(z.unknown()),
  }),
  create_time: z.number(),
  content: z.object({
    content_type: z.enum(['text', 'code', 'execution_output']),
    parts: z.optional(z.array(z.string())), // [''] if author.role === 'system', optional if content_type === 'code'
  }),
  status: z.string(),
  end_turn: z.optional(z.boolean()),
  weight: z.number(),
  metadata: z.record(z.unknown()),
  recipient: z.enum(['all', 'python']),
});

const openaiNodeSchema = z.object({
  id: z.string(),
  message: openaiMessageSchema.optional(),
  parent: z.optional(z.string()),
  children: z.array(z.string()),
});

export const openaiChatDataSchema = z.object({
  title: z.string(),
  create_time: z.number(),
  update_time: z.number(),
  // mapping: z.record(openaiNodeSchema), // comment out, to reduce the data transfer - 'duplicate' of linear_conversation
  moderation_results: z.array(z.unknown()),
  current_node: z.string(),
  is_public: z.boolean(),
  linear_conversation: z.array(openaiNodeSchema),
  has_user_editable_context: z.boolean(),
  continue_conversation_url: z.string(),
  model: z.object({
    slug: z.string(),
    max_tokens: z.number(),
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
  }),
  moderation_state: z.record(z.unknown()),
});

export type OpenAISharedChatSchema = z.infer<typeof openaiChatDataSchema>;

const openaiShallowSharePageContent = z.object({
  props: z.object({
    // [... omit ...]
    pageProps: z.object({
      // [... omit ...]
      continueMode: z.boolean(),
      moderationMode: z.boolean(),
      serverResponse: z.object({
        data: openaiChatDataSchema,
      }),
      sharedConversationId: z.string(),
    }),
  }),
});


export async function openAIImportSharedConversation(htmlPage: string) {
  // extract embedded JSON string
  const jsonString = htmlPage.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/)?.[1];
  if (!jsonString)
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Failed to extract JSON object from HTML page',
    });

  // parse the string to JSON
  let jsonObject: object;
  try {
    jsonObject = JSON.parse(jsonString);
  } catch (error: any) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Failed to parse JSON object: ${error?.message}`,
    });
  }

  // validate the JSON object
  const safeJson = openaiShallowSharePageContent.safeParse(jsonObject);
  if (!safeJson.success)
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Failed to validate JSON object: ${safeJson.error.message}`,
    });

  // just return the conversation data
  return safeJson.data;
}
