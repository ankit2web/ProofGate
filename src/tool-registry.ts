import { getBalance, transfer } from "./fake-bank.js";
import { getPayment, refundPayment } from "./fake-payments.js";
import { z } from "zod";

const TransferMoneyRequestSchema = z
  .object({
    action: z.literal("transfer_money"),
    environment: z.enum(["development", "staging", "production"]).optional(),
    amount: z.number().positive(),
  })
  .strict();

const RefundPaymentRequestSchema = z
  .object({
    action: z.literal("refund_payment"),
    environment: z.enum(["development", "staging", "production"]).optional(),
    paymentId: z.string().min(1),
    amount: z.number().positive(),
  })
  .strict();

export type ToolRequest = {
  action: string;
  environment?: string | undefined;
  amount?: number;
  paymentId?: string;
};

export type ToolDefinition = {
  name: string;

  validateRequest: (request: unknown) => ToolRequest;

  getTrustedState: (request: ToolRequest) => Promise<Record<string, unknown>>;

  calculateAfterState: (
    request: ToolRequest,
    trustedState: Record<string, unknown>,
  ) => Record<string, unknown>;

  execute: (request: ToolRequest) => Promise<unknown>;
};

const transferMoneyTool: ToolDefinition = {
  name: "transfer_money",

  validateRequest(request) {
    return TransferMoneyRequestSchema.parse(request);
  },

  async getTrustedState() {
    return {
      balance: getBalance(),
    };
  },

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

  async execute(request) {
    if (typeof request.amount !== "number") {
      throw new Error("Transfer amount is required.");
    }

    return transfer(request.amount);
  },
};

const refundPaymentTool: ToolDefinition = {
  name: "refund_payment",

  validateRequest(request) {
    return RefundPaymentRequestSchema.parse(request);
  },

  async getTrustedState(request) {
    if (!request.paymentId) {
      throw new Error("Payment ID is required.");
    }

    const payment = getPayment(request.paymentId);

    return {
      payment_amount: payment.amount,
      payment_status: payment.status,
    };
  },

  calculateAfterState(request, trustedState) {
    const state: Record<string, unknown> = {
      ...request,
      ...trustedState,
    };

    if (
      typeof trustedState.payment_amount === "number" &&
      typeof request.amount === "number"
    ) {
      state.refund_after = trustedState.payment_amount - request.amount;
    }

    return state;
  },

  async execute(request) {
    if (!request.paymentId) {
      throw new Error("Payment ID is required.");
    }

    if (typeof request.amount !== "number") {
      throw new Error("Refund amount is required.");
    }

    return refundPayment(request.paymentId, request.amount);
  },
};

const tools = new Map<string, ToolDefinition>();

tools.set(transferMoneyTool.name, transferMoneyTool);

tools.set(refundPaymentTool.name, refundPaymentTool);

export function getTool(name: string): ToolDefinition {
  const tool = tools.get(name);

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return tool;
}
