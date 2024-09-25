import type { ZodObject } from 'zod';
import { JsonSchema7ObjectType, zodToJsonSchema } from 'zod-to-json-schema';

import type { AixTools_FunctionCallDefinition } from '../server/api/aix.wiretypes';
import { DMessageContentFragment, DMessageToolInvocationPart, isContentFragment } from '~/common/stores/chat/chat.fragments';


// configuration
const AIX_DEBUG_CLIENT_TOOLS = process.env.NODE_ENV === 'development';


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


/** Extract the function name from the Aix FunctionCall Tool Definition */
export function aixRequireSingleFunctionCallInvocation(fragments: DMessageContentFragment[], expectedFunctionName: string, debugLabel: string): {
  invocation: Extract<DMessageToolInvocationPart['invocation'], { type: 'function_call' }>;
  argsObject: object;
} {

  if (!Array.isArray(fragments) || fragments.length !== 1) {
    if (AIX_DEBUG_CLIENT_TOOLS)
      console.error('[DEV] single-function-call: invalid fragments:', fragments, 'for', debugLabel);
    throw new Error('AIX: Unexpected response for ' + debugLabel);
  }

  if (!isContentFragment(fragments[0]) || fragments[0].part.pt !== 'tool_invocation') {
    if (AIX_DEBUG_CLIENT_TOOLS)
      console.error('[DEV] single-function-call: invalid fragment part:', fragments[0].part, 'for', debugLabel);
    throw new Error('AIX: Missing tool invocation for ' + debugLabel);
  }

  const { invocation } = fragments[0].part;

  if (invocation.type !== 'function_call' || invocation.name !== expectedFunctionName) {
    if (AIX_DEBUG_CLIENT_TOOLS)
      console.error('[DEV] single-function-call: invalid invocation:', invocation, 'for', debugLabel);
    throw new Error('AIX: Expected a function call to ' + expectedFunctionName + ' for ' + debugLabel);
  }

  if (!invocation.args) {
    if (AIX_DEBUG_CLIENT_TOOLS)
      console.error('[DEV] single-function-call: missing invocation args:', invocation, 'for', debugLabel);
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
