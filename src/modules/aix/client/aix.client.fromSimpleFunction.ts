import { ZodSchema } from 'zod';
import { JsonSchema7ObjectType, zodToJsonSchema } from 'zod-to-json-schema';

import type { AixTools_FunctionCallDefinition } from '../server/api/aix.wiretypes';
import { DMessageContentFragment, DMessageToolInvocationPart, isContentFragment } from '~/common/stores/chat/chat.fragments';


// configuration
const AIX_DEBUG_CLIENT_TOOLS = process.env.NODE_ENV === 'development';


export type AixClientFunctionCallToolDefinition = {
  name: string;
  description: string;
  /**
   * The input schema for the function call.
   * We only accept objects, not arrays - as downstream APIs have spotty implementation for non-object.
   * If the function does not take any inputs, use `Zod.object({})` or Zod.void().
   */
  inputSchema: ZodSchema<object /*| void*/>;
}


/**
 * Create an Aix FunctionCall Tool Definition from a simple function definition.
 * @param functionCall
 */
export function aixFunctionCallTool(functionCall: AixClientFunctionCallToolDefinition): AixTools_FunctionCallDefinition {
  const { properties, required } = zodToJsonSchema(functionCall.inputSchema, { $refStrategy: 'none' }) as JsonSchema7ObjectType;
  const takesNoInputs = !Object.keys(properties || {}).length;
  return {
    type: 'function_call',
    function_call: {
      name: functionCall.name,
      description: functionCall.description,
      ...(!takesNoInputs && {
        input_schema: {
          properties: _recursiveObjectSchemaCleanup(properties),
          ...(required && { required }),
        },
      }),
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


/** Extract the function name from the Aix FunctionCall Tool Definition */
export function aixRequireSingleFunctionCallInvocation(fragments: DMessageContentFragment[], expectedFunctionName: string, allowThinkPart: boolean, debugLabel: string): {
  invocation: Extract<DMessageToolInvocationPart['invocation'], { type: 'function_call' }>;
  argsObject: object;
} {

  if (!Array.isArray(fragments) || !(fragments.length >= 1)) {
    if (AIX_DEBUG_CLIENT_TOOLS)
      console.error(`[DEV] single-function-call (${debugLabel}): invalid fragments:`, { fragments });
    throw new Error('AIX: Unexpected response.');
  }

  const toolIdx = allowThinkPart ? fragments.length - 1 : 0;
  if (!isContentFragment(fragments[toolIdx]) || fragments[toolIdx].part.pt !== 'tool_invocation') {
    if (AIX_DEBUG_CLIENT_TOOLS)
      console.error(`[DEV] single-function-call (${debugLabel}): invalid fragment part:`, { part: fragments[toolIdx].part });

    // special case, if we have an error part, rethrow that message instead (better error message)
    if (fragments[toolIdx].part.pt === 'error')
      throw new Error('AIX: Error invoking function: ' + fragments[toolIdx].part.error);

    throw new Error('AIX: Missing function invocation.');
  }

  const { invocation } = fragments[toolIdx].part;

  if (invocation.type !== 'function_call' || invocation.name !== expectedFunctionName) {
    if (AIX_DEBUG_CLIENT_TOOLS)
      console.error(`[DEV] single-function-call (${debugLabel}): invalid invocation:`, { invocation });
    throw new Error('AIX: Expected a function call.');
  }

  if (!invocation.args) {
    if (AIX_DEBUG_CLIENT_TOOLS)
      console.error(`[DEV] single-function-call (${debugLabel}): missing invocation args:`, { invocation });
    throw new Error('AIX: Missing function arguments.');
  }

  try {
    return {
      invocation,
      argsObject: JSON.parse(invocation.args),
    };
  } catch (e) {
    if (process.env.NODE_ENV === 'development')
      console.error('[DEV] single-function-call: invalid invocation args:', invocation, 'for', debugLabel);
    throw new Error('AIX: Invalid function arguments.');
  }
}
