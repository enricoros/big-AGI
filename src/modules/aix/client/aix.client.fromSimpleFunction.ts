import * as z from 'zod/v4';

import type { AixTools_FunctionCallDefinition } from '../server/api/aix.wiretypes';
import { DMessageContentFragment, DMessageToolInvocationPart, DMessageVoidFragment, isContentFragment } from '~/common/stores/chat/chat.fragments';


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
  inputSchema: z.ZodObject; // zod-4 object
}


/**
 * Create an Aix FunctionCall Tool Definition from a simple function definition.
 * @param functionCall
 */
export function aixFunctionCallTool(functionCall: AixClientFunctionCallToolDefinition): AixTools_FunctionCallDefinition {

  // convert a Zod schema to JSON Schema
  const { properties, required } = z.toJSONSchema(functionCall.inputSchema, {
    // config
    io: 'input', // avoids AdditionalProperties by looking at the Zod schema from the input perspective
    target: 'draft-2020-12', // (default) newest standard
    reused: 'inline', // (default) inline reused schemas

    // [DEV] makes sure we specify good tool definitions
    cycles: 'throw',
    unrepresentable: 'throw',
  });

  const takesNoInputs = !Object.keys(properties || {}).length;
  return {
    type: 'function_call',
    function_call: {
      name: functionCall.name,
      description: functionCall.description,
      ...(!takesNoInputs && {
        input_schema: {
          properties: properties as any, // FIXME: remove the 'as any' after the full migration to zod-4
          ...(!!required?.length && {
            required: required,
          }),
        },
      }),
    },
  };
}


/** Extract the function name from the Aix FunctionCall Tool Definition */
export function aixRequireSingleFunctionCallInvocation(fragments: (DMessageContentFragment | DMessageVoidFragment)[], expectedFunctionName: string, allowThinkPart: boolean, debugLabel: string): {
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
