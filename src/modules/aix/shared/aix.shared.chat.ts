import { z } from 'zod';

import { aixToolsSchema } from './aix.shared.tools';


/// GENERATE INPUT Schema ///

const aixChatGenerateInputSchema = z.object({
  // access: openAIAccessSchema,
  // model: openAIModelSchema,
  // history: openAIHistorySchema,
  tools: aixToolsSchema.optional(),
  // context: llmsGenerateContextSchema,
  // stream? -> implicit via the function name
});


