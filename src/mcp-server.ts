import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { randomUUID } from "node:crypto";

import { execute } from "./proofgate.js";

export function createServer() {
  const server = new McpServer({
    name: "proofgate",
    version: "0.1.0",
  });

  server.registerTool(
    "transfer_money",
    {
      description:
        "Transfer money through ProofGate. The request is verified against trusted bank state and configured policies before execution.",
      inputSchema: z.object({
        amount: z.number().positive(),
        environment: z
          .enum(["development", "staging", "production"])
          .optional(),
      }),
    },
    async (args) => {
      const traceId = `pg_${randomUUID()}`;

      const request = {
        action: "transfer_money",
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
          isError:
            !result.verification.allowed || Boolean(result.executionError),
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
    "refund_payment",
    {
      description:
        "Refund a payment through ProofGate. The payment state and refund amount are verified against configured policies before execution.",
      inputSchema: z.object({
        paymentId: z.string().min(1),
        amount: z.number().positive(),
        environment: z
          .enum(["development", "staging", "production"])
          .optional(),
      }),
    },
    async (args) => {
      const traceId = `pg_${randomUUID()}`;

      const request = {
        action: "refund_payment",
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
          isError:
            !result.verification.allowed || Boolean(result.executionError),
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
