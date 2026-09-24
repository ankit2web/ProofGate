import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  verifyPolicy,
  type Policy,
} from "../src/policy-engine.js";

import * as toolExecutor from "../src/tool-executor.js";

describe("Execution Boundary", () => {
  const policy: Policy = {
    name: "Financial Protection",

    rules: [
      {
        name: "transfer_limit",
        action: "transfer_money",
        condition: "amount <= 10000",
        effect: "allow",
        reason:
          "Transfers cannot exceed ₹10,000.",
      },
      {
        name: "sufficient_balance",
        action: "transfer_money",
        condition: "balance >= amount",
        effect: "allow",
        reason: "Insufficient balance.",
      },
      {
        name: "minimum_remaining_balance",
        action: "transfer_money",
        condition: "balance - amount >= 1000",
        effect: "allow",
        reason:
          "At least ₹1,000 must remain after the transfer.",
      },
    ],
  };

  it("blocks unsafe requests before execution", async () => {
    const executeSpy = vi.spyOn(
      toolExecutor,
      "executeTool",
    );

    const verification =
      await verifyPolicy(
        policy,
        {
          action: "transfer_money",
          amount: 19500,
        },
        {
          action: "transfer_money",
          amount: 19500,
          balance: 20000,
          balance_after: 500,
        },
      );

    expect(
      verification.allowed,
    ).toBe(false);

    expect(executeSpy).not.toHaveBeenCalled();

    executeSpy.mockRestore();
  });

  it("allows safe requests to proceed to execution", async () => {
    const executeSpy = vi
      .spyOn(toolExecutor, "executeTool")
      .mockResolvedValue({
        success: true,
        transferred: 5000,
        remainingBalance: 15000,
      });

    const verification =
      await verifyPolicy(
        policy,
        {
          action: "transfer_money",
          amount: 5000,
        },
        {
          action: "transfer_money",
          amount: 5000,
          balance: 20000,
          balance_after: 15000,
        },
      );

    expect(
      verification.allowed,
    ).toBe(true);

    await toolExecutor.executeTool({
      action: "transfer_money",
      amount: 5000,
    });

    expect(
      executeSpy,
    ).toHaveBeenCalledTimes(1);

    expect(
      executeSpy,
    ).toHaveBeenCalledWith({
      action: "transfer_money",
      amount: 5000,
    });

    executeSpy.mockRestore();
  });
});