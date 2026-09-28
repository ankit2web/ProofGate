import { z } from "zod";

import { getBankState, transfer } from "../fake-bank.js";

import type { ToolDefinition, ToolRequest } from "../tool-definition.js";

const TransferMoneyRequestSchema = z
  .object({
    action: z.literal("transfer_money"),
    environment: z.enum(["development", "staging", "production"]).optional(),
    amount: z.number().positive(),
  })
  .strict();

const TransferMoneyMcpInputSchema = z
  .object({
    amount: z.number().positive(),
    environment: z.enum(["development", "staging", "production"]).optional(),
  })
  .strict();

export const transferMoneyTool: ToolDefinition = {
  name: "transfer_money",

  description:
    "Transfer money through ProofGate. The request is verified against trusted bank state and configured policies before execution.",

  mcpInputSchema: TransferMoneyMcpInputSchema,

  validateRequest(request) {
    return TransferMoneyRequestSchema.parse(request);
  },

  getTrustedState: async () => getBankState(),

  calculateAfterState(request, trustedState) {
    const state: Record<string, unknown> = {
      ...request,
      ...trustedState,
    };

    if (
      typeof trustedState.balance === "number" &&
      typeof request.amount === "number"
    ) {
      state.balance_after = trustedState.balance - request.amount;
    }

    return state;
  },

  async execute(request, trustedState) {
    if (typeof request.amount !== "number") {
      throw new Error("Transfer amount is required.");
    }

    if (typeof trustedState.state_version !== "number") {
      throw new Error("Trusted bank state version is required.");
    }

    return transfer(request.amount, trustedState.state_version);
  },
};
