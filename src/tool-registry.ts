import { getBalance, transfer } from "./fake-bank.js";

export type ToolRequest = {
  action: string;
  environment?: string;
  amount?: number;
  paymentId?: string;
};

export type ToolDefinition = {
  name: string;

  getTrustedState: (
    request: ToolRequest,
  ) => Promise<Record<string, unknown>>;

  calculateAfterState: (
    request: ToolRequest,
    trustedState: Record<string, unknown>,
  ) => Record<string, unknown>;

  execute: (
    request: ToolRequest,
  ) => Promise<unknown>;
};

const transferMoneyTool: ToolDefinition = {
  name: "transfer_money",

  async getTrustedState() {
    return {
      balance: getBalance(),
    };
  },

  calculateAfterState(
    request,
    trustedState,
  ) {
    const state: Record<string, unknown> = {
      ...request,
      ...trustedState,
    };

    if (
      typeof trustedState.balance === "number" &&
      typeof request.amount === "number"
    ) {
      state.balance_after =
        trustedState.balance - request.amount;
    }

    return state;
  },

  async execute(request) {
    if (typeof request.amount !== "number") {
      throw new Error(
        "Transfer amount is required.",
      );
    }

    return transfer(request.amount);
  },
};

const tools = new Map<string, ToolDefinition>();

tools.set(
  transferMoneyTool.name,
  transferMoneyTool,
);

export function getTool(
  name: string,
): ToolDefinition {
  const tool = tools.get(name);

  if (!tool) {
    throw new Error(
      `Unknown tool: ${name}`,
    );
  }

  return tool;
}