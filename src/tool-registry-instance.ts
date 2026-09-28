import { createToolRegistry } from "./tool-registry.js";

import { transferMoneyTool } from "./tools/transfer-money.js";

import { refundPaymentTool } from "./tools/refund-payment.js";

import { sendNotificationTool } from "./tools/send-notification.js";

export const toolRegistry = createToolRegistry([
  transferMoneyTool,
  refundPaymentTool,
  sendNotificationTool,
]);
