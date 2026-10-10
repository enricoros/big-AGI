import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { AixTools_FunctionCallDefinition } from '~/modules/aix/server/api/aix.wiretypes';

/**
 * Maps an MCP tool definition to a big-AGI internal tool definition
 * so that LLMs can consume them via the Aix tools pipeline.
 */
export function mcpToolToAixTool(mcpTool: Tool): AixTools_FunctionCallDefinition {
  const properties: Record<string, any> = {};
  if (mcpTool.inputSchema && typeof mcpTool.inputSchema === 'object' && mcpTool.inputSchema.properties) {
    for (const [key, val] of Object.entries(mcpTool.inputSchema.properties as Record<string, any>)) {
      let propType: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' = 'string';
      if (['string', 'number', 'integer', 'boolean', 'array', 'object'].includes(val?.type)) {
        propType = val.type;
      }
      properties[key] = {
        type: propType,
        description: val?.description || val?.title || key,
      };
    }
  }
  const required = Array.isArray(mcpTool.inputSchema?.required) ? (mcpTool.inputSchema.required as string[]) : undefined;

  return {
    type: 'function_call',
    function_call: {
      name: mcpTool.name,
      description: mcpTool.description || `Tool: ${mcpTool.name}`,
      input_schema: {
        properties,
        ...(required?.length ? { required } : {}),
      },
    },
  };
}
