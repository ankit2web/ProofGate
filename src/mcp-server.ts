import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { randomUUID } from "node:crypto";

import { execute } from "./proofgate.js";
import { toolRegistry } from "./tool-registry-instance.js";

export function createServer() {
  const server = new McpServer({
    name: "ProofGate MCP Server",
    version: "0.1.0",
  });

  const tools = toolRegistry.getTools();

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.mcpInputSchema,
      },
      async (args) => {
        const traceId = `pg_${randomUUID()}`;

        const request = {
          action: tool.name,
          ...args,
        };

        try {
          const result = await execute(request, traceId);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
            isError: Boolean(result.executionError),
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    traceId,
                    error: message,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}

if (process.argv[1]?.endsWith("mcp-server.ts")) serveStdio(createServer);
