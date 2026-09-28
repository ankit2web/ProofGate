import { z } from "zod";

import { getPayment, refundPayment } from "../fake-payments.js";

import type { ToolDefinition } from "../tool-definition.js";

const RefundPaymentRequestSchema = z
  .object({
    action: z.literal("refund_payment"),
    environment: z.enum(["development", "staging", "production"]).optional(),
    paymentId: z.string().min(1),
    amount: z.number().positive(),
  })
  .strict();

const RefundPaymentMcpInputSchema = z
  .object({
    paymentId: z.string().min(1),
    amount: z.number().positive(),
    environment: z.enum(["development", "staging", "production"]).optional(),
  })
  .strict();

export const refundPaymentTool: ToolDefinition = {
  name: "refund_payment",

  description:
    "Refund a payment through ProofGate. The request is verified against trusted payment state and configured policies before execution.",

  mcpInputSchema: RefundPaymentMcpInputSchema,

  validateRequest(request) {
    return RefundPaymentRequestSchema.parse(request);
  },

  async getTrustedState(request) {
    if (typeof request.paymentId !== "string") {
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
    if (typeof request.paymentId !== "string") {
      throw new Error("Payment ID is required.");
    }

    if (typeof request.amount !== "number") {
      throw new Error("Refund amount is required.");
    }

    return refundPayment(request.paymentId, request.amount);
  },
};
