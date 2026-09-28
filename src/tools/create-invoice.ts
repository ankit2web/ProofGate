import { z } from "zod";
import type { ToolDefinition } from "../tool-definition.js";

const CreateInvoiceRequestSchema = z
  .object({
    action: z.literal("create_invoice"),
    amount: z.number().positive(),
    currency: z.string(),
    customerStatus: z.string(),
  })
  .strict();

const CreateInvoiceMcpInputSchema = z
  .object({
    amount: z.number().positive(),
    currency: z.string(),
    customerStatus: z.string(),
  })
  .strict();

export const createInvoiceTool: ToolDefinition = {
  name: "create_invoice",

  description: "Create an invoice for an active customer.",

  mcpInputSchema: CreateInvoiceMcpInputSchema,

  validateRequest(request: unknown) {
    return CreateInvoiceRequestSchema.parse(request);
  },

  async getTrustedState(request) {
    return {
      customer_status: request.customerStatus,
    };
  },

  calculateAfterState(request, trustedState) {
    return {
      ...trustedState,
      amount: request.amount,
      currency: request.currency,
    };
  },

  async execute(request) {
    return {
      success: true,
      invoiceId: `invoice_${Date.now()}`,
      amount: request.amount,
      currency: request.currency,
    };
  },
};
