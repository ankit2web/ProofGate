import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { randomUUID } from "node:crypto";

import { execute } from "./proofgate.js";
import { getTools } from "./tool-registry.js";

export function createServer() {
  const server = new McpServer({
    name: "ProofGate MCP Server",
    version: "0.1.0",
  });

  const tools = getTools();

  const transferTool = tools.find((tool) => tool.name === "transfer_money");

  const refundTool = tools.find((tool) => tool.name === "refund_payment");

  if (!transferTool || !refundTool) {
    throw new Error("Required ProofGate tools are not registered.");
  }

  server.registerTool(
    transferTool.name,
    {
      description: transferTool.description,
      inputSchema: transferTool.mcpInputSchema,
    },
    async (args) => {
      const traceId = `pg_${randomUUID()}`;

      const request = {
        action: transferTool.name,
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
        const message = error instanceof Error ? error.message : String(error);

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

  server.registerTool(
    refundTool.name,
    {
      description: refundTool.description,
      inputSchema: refundTool.mcpInputSchema,
    },
    async (args) => {
      const traceId = `pg_${randomUUID()}`;

      const request = {
        action: refundTool.name,
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
        const message = error instanceof Error ? error.message : String(error);

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

  return server;
}

if (process.argv[1]?.endsWith("mcp-server.ts")) {
  serveStdio(createServer);
}
