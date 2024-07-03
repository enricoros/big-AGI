import { z } from 'zod';

import { aixAccessSchema, aixHistorySchema, aixModelSchema, aixStreamingContextSchema } from '~/modules/aix/shared/aix.shared.types';
import { aixToolsPolicySchema, aixToolsSchema } from './aix.shared.tools';


/// GENERATE INPUT Schema ///

export type AixGenerateContentInput = z.infer<typeof aixGenerateContentInputSchema>;

export const aixGenerateContentInputSchema = z.object({
  access: aixAccessSchema,
  model: aixModelSchema,
  history: aixHistorySchema,
  tools: aixToolsSchema.optional(),
  toolPolicy: aixToolsPolicySchema.optional(),
  context: aixStreamingContextSchema,
  // stream? -> discriminated via the rpc function name
});
