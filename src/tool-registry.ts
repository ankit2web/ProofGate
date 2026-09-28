import { getBankState, transfer } from "./fake-bank.js";
import { getPayment, refundPayment } from "./fake-payments.js";
import {
  sendNotification,
  isRecipientAuthorized,
} from "./fake-notifications.js";
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

const SendNotificationMcpInputSchema = z
  .object({
    recipient: z.string().min(1),
    message: z.string().min(1),
    environment: z.enum(["development", "staging", "production"]).optional(),
  })
  .strict();

const SendNotificationRequestSchema = z
  .object({
    action: z.literal("send_notification"),
    environment: z.enum(["development", "staging", "production"]).optional(),
    recipient: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export type ToolRequest = {
  action: string;
  environment?: string | undefined;
  amount?: number;
  paymentId?: string;
  recipient?: string;
  message?: string;
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
  ) => Promise<unknown>;
};

const TransferMoneyMcpInputSchema = z
  .object({
    amount: z.number().positive(),
    environment: z.enum(["development", "staging", "production"]).optional(),
  })
  .strict();

const RefundPaymentMcpInputSchema = z
  .object({
    paymentId: z.string().min(1),
    amount: z.number().positive(),
    environment: z.enum(["development", "staging", "production"]).optional(),
  })
  .strict();

const transferMoneyTool: ToolDefinition = {
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

const refundPaymentTool: ToolDefinition = {
  name: "refund_payment",

  description:
    "Refund a payment through ProofGate. The request is verified against trusted payment state and configured policies before execution.",
  mcpInputSchema: RefundPaymentMcpInputSchema,
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

  async execute(request, _trustedState) {
    if (!request.paymentId) {
      throw new Error("Payment ID is required.");
    }

    if (typeof request.amount !== "number") {
      throw new Error("Refund amount is required.");
    }

    return refundPayment(request.paymentId, request.amount);
  },
};

const sendNotificationTool: ToolDefinition = {
  name: "send_notification",

  description:
    "Send a notification through ProofGate after validating authorization.",

  mcpInputSchema: SendNotificationMcpInputSchema,

  validateRequest(request) {
    return SendNotificationRequestSchema.parse(request);
  },

  async getTrustedState(request) {
    if (typeof request.recipient !== "string") {
      throw new Error("Recipient is required.");
    }

    return {
      recipient_authorized: isRecipientAuthorized(request.recipient),
    };
  },

  calculateAfterState(request, trustedState) {
    return {
      ...trustedState,
      ...request,
    };
  },

  async execute(request, _trustedState) {
    if (typeof request.recipient !== "string") {
      throw new Error("Recipient is required.");
    }

    if (typeof request.message !== "string") {
      throw new Error("Message is required.");
    }

    return sendNotification(request.recipient, request.message);
  },
};

const tools = new Map<string, ToolDefinition>();

tools.set(transferMoneyTool.name, transferMoneyTool);

tools.set(refundPaymentTool.name, refundPaymentTool);

tools.set(sendNotificationTool.name, sendNotificationTool);

export function getTool(name: string): ToolDefinition {
  const tool = tools.get(name);

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return tool;
}

export function getTools(): ToolDefinition[] {
  return Array.from(tools.values());
}
