import { z } from 'zod';


//
// JSON validation - used before saving to DB/sync transmission - to ensure valid structure
//

const literalSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
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
export function isValidJson(value: unknown): value is Json {
  return jsonSchema.safeParse(value).success;
}
