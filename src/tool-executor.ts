import { transfer } from "./fake-bank.js";

type ToolRequest = {
  action: string;
  amount?: number;
};

export async function executeTool(
  request: ToolRequest,
) {
  switch (request.action) {
    case "transfer_money": {
      if (typeof request.amount !== "number") {
        throw new Error(
          "Transfer amount is required.",
        );
      }

      return transfer(request.amount);
    }

    default:
      throw new Error(
        `Unknown tool: ${request.action}`,
      );
  }
}