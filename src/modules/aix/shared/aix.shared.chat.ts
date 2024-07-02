import { z } from 'zod';

import { aixToolsPolicySchema, aixToolsSchema } from './aix.shared.tools';


/// GENERATE INPUT Schema ///

export const aixChatGenerateInputSchema = z.object({
  // access: openAIAccessSchema,
  // model: openAIModelSchema,
  // history: openAIHistorySchema,
  tools: aixToolsSchema.optional(),
  toolPolicy: aixToolsPolicySchema.optional(),
  // context: llmsGenerateContextSchema,
  // stream? -> implicit via the function name
});


