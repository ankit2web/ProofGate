import { z } from "zod";

import {
  sendNotification,
  isRecipientAuthorized,
} from "../fake-notifications.js";

import type { ToolDefinition } from "../tool-definition.js";

const SendNotificationRequestSchema = z
  .object({
    action: z.literal("send_notification"),
    environment: z.enum(["development", "staging", "production"]).optional(),
    recipient: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

const SendNotificationMcpInputSchema = z
  .object({
    recipient: z.string().min(1),
    message: z.string().min(1),
    environment: z.enum(["development", "staging", "production"]).optional(),
  })
  .strict();

export const sendNotificationTool: ToolDefinition = {
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
