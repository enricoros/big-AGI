import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { McpClientManager } from './mcp.client';
import { mcpToolToAixTool } from './mcp.tools';

export const mcpRouter = createTRPCRouter({
  /**
   * Lists all available tools from the FastMCP server
   */
  listTools: publicProcedure.query(async () => {
    try {
      const client = await McpClientManager.getInstance().connectSSEServer('http://127.0.0.1:8000/sse', 'default-mcp');
      const toolsResult = await client.listTools();
      if (toolsResult?.tools?.length) {
        return {
          tools: toolsResult.tools.map(mcpToolToAixTool),
        };
      }
      return { tools: [] };
    } catch (e: any) {
      console.warn('[MCP Router] Failed to list tools:', e?.message || e);
      return { tools: [] };
    }
  }),

  /**
   * Calls a tool on the FastMCP server
   */
  callTool: publicProcedure
    .input(z.object({
      name: z.string(),
      args: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const client = await McpClientManager.getInstance().connectSSEServer('http://127.0.0.1:8000/sse', 'default-mcp');
        const result = await client.callTool({
          name: input.name,
          arguments: input.args || {},
        });
        
        let output = '';
        if (result && Array.isArray(result.content)) {
          output = (result.content as Array<{ type: string; text?: string }>).map(c => (c.type === 'text' && c.text ? c.text : JSON.stringify(c))).join('\n');
        } else {
          output = JSON.stringify(result);
        }
        
        return {
          ok: true,
          output,
        };
      } catch (e: any) {
        console.error(`[MCP Router] Failed to call tool ${input.name}:`, e);
        return {
          ok: false,
          error: e?.message || String(e),
        };
      }
    }),
});
