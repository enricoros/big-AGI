import { z } from 'zod';

import { maybeDebuggerBreak } from '~/common/util/errorUtils';


// configuration
const ENABLE_NON_STANDARD = false; // if true, it will enable 'undefined' as a valid value in JSON objects


//
// JSON validation - used before saving to DB/sync transmission - to ensure valid structure
//

const literalSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  // NON-STANDARD, but adding this because we do have 'undefined' in in-mem objects
  ...(ENABLE_NON_STANDARD ? [z.undefined()] : []),
]);

type Literal = z.infer<typeof literalSchema>;
type Json = Literal | Json[] | { [key: string]: Json };

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    literalSchema,
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);

/**
 * Checks if the given value is a valid JSON object, which will be serialized
 * without errors for storage or transmission.
 */
export function isValidJson(value: unknown, debugLocation: string): value is Json {
  const result = jsonSchema.safeParse(value);
  if (result.success)
    return true;

  console.log(`[DEV] ${debugLocation}: Invalid JSON:`, { error: result.error });
  maybeDebuggerBreak();
  return result.success;
}
