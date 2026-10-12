import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

/**
 * Singleton manager for MCP clients
 */
export class McpClientManager {
  private static instance: McpClientManager;
  private clients: Map<string, Client> = new Map();

  private constructor() {}

  public static getInstance(): McpClientManager {
    if (!McpClientManager.instance) {
      McpClientManager.instance = new McpClientManager();
    }
    return McpClientManager.instance;
  }

  /**
   * Connects to an SSE MCP server and returns the client instance
   * @param serverUrl The URL of the SSE MCP server
   * @param connectionId A unique identifier for this connection
   */
  public async connectSSEServer(serverUrl: string, connectionId: string): Promise<Client> {
    if (this.clients.has(connectionId)) {
      return this.clients.get(connectionId)!;
    }

    try {
      const transport = new SSEClientTransport(new URL(serverUrl));
      
      const client = new Client(
        {
          name: 'big-agi-mcp-client',
          version: '1.0.0',
        },
        {
          capabilities: {}
        }
      );

      await client.connect(transport);
      this.clients.set(connectionId, client);
      
      return client;
    } catch (error) {
      console.error(`Failed to connect to MCP SSE server at ${serverUrl}:`, error);
      throw error;
    }
  }

  /**
   * Disconnects and removes a client
   * @param connectionId The connection identifier
   */
  public async disconnectClient(connectionId: string): Promise<void> {
    const client = this.clients.get(connectionId);
    if (client) {
      await client.close();
      this.clients.delete(connectionId);
    }
  }

  /**
   * Retrieves an existing client
   * @param connectionId The connection identifier
   */
  public getClient(connectionId: string): Client | undefined {
    return this.clients.get(connectionId);
  }
}
