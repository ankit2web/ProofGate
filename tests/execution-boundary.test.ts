import {
  describe,
  expect,
  it,
} from "vitest";

import {
  verifyPolicy,
  type Policy,
} from "../src/policy-engine.js";

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

  it("allows a safe request to reach the verified state", async () => {
    const result = await verifyPolicy(
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

    expect(result.allowed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("blocks an unsafe request before execution", async () => {
    const result = await verifyPolicy(
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

    expect(result.allowed).toBe(false);

    expect(
      result.violations,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "transfer_limit",
        }),
        expect.objectContaining({
          rule: "minimum_remaining_balance",
        }),
      ]),
    );
  });
});