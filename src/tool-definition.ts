import { z } from "zod";

export type ToolRequest = {
  action: string;
  environment?: string | undefined;
  [key: string]: unknown;
};

export type ToolExecutionContext = {
  idempotencyKey?: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  mcpInputSchema: z.ZodObject;

  validateRequest: (request: unknown) => ToolRequest;

  getTrustedState: (request: ToolRequest) => Promise<Record<string, unknown>>;

  calculateAfterState: (
    request: ToolRequest,
    trustedState: Record<string, unknown>,
  ) => Record<string, unknown>;

  execute: (
    request: ToolRequest,
    trustedState: Record<string, unknown>,
    context?: ToolExecutionContext,
  ) => Promise<unknown>;
};
