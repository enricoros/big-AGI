import type { ZodObject } from 'zod';
import { JsonSchema7ObjectType, zodToJsonSchema } from 'zod-to-json-schema';

import type { AixTools_FunctionCallDefinition } from '../server/api/aix.wiretypes';


export type AixClientFunctionCallToolDefinition = {
  name: string;
  description: string;
  inputSchema: ZodObject<any>;
}


/**
 * Create an Aix FunctionCall Tool Definition from a simple function definition.
 * @param functionCall
 */
export function aixFunctionCallTool(functionCall: AixClientFunctionCallToolDefinition): AixTools_FunctionCallDefinition {
  const { properties, required } = zodToJsonSchema(functionCall.inputSchema, { $refStrategy: 'none' }) as JsonSchema7ObjectType;
  return {
    type: 'function_call',
    function_call: {
      name: functionCall.name,
      description: functionCall.description,
      input_schema: {
        properties: _recursiveObjectSchemaCleanup(properties),
        required,
      },
    },
  };
}


/* Recursive function to clean up the Schema object, to:
 * - remove extra 'additionalProperties' keys
 * - reorder the keys of object/array description objects to be: ['type', 'description', ..., 'required']
 */
function _recursiveObjectSchemaCleanup(obj: Record<string, any>, thisKey?: string): Record<string, any> {
  if (typeof obj !== 'object' || obj === null)
    return obj; // leaf node

  const { additionalProperties: _, ...rest } = obj;

  // 'properties' are ordered and we don't want to re-sort them
  if (thisKey === 'properties') {
    return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, _recursiveObjectSchemaCleanup(value, key)]));
  }

  const { type, description, required, ...others } = rest;
  return {
    ...(type && { type }),
    ...(description && { description }),
    ...Object.fromEntries(Object.entries(others).map(([key, value]) => [key, _recursiveObjectSchemaCleanup(value, key)])),
    ...(required && { required }),
  };
}
