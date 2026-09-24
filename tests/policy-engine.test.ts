import { describe, expect, it } from "vitest";
import {
  verifyPolicy,
  type Policy,
} from "../src/policy-engine.js";

describe("Policy Engine", () => {
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
        condition:
          "balance - amount >= 1000",
        effect: "allow",
        reason:
          "At least ₹1,000 must remain after the transfer.",
      },
    ],
  };

  it("allows a valid transfer", async () => {
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

  it("blocks a transfer above the limit", async () => {
    const result = await verifyPolicy(
      policy,
      {
        action: "transfer_money",
        amount: 15000,
      },
      {
        action: "transfer_money",
        amount: 15000,
        balance: 20000,
        balance_after: 5000,
      },
    );

    expect(result.allowed).toBe(false);

    expect(result.violations).toContainEqual({
      rule: "transfer_limit",
      reason:
        "Transfers cannot exceed ₹10,000.",
    });
  });

  it("blocks insufficient balance", async () => {
    const result = await verifyPolicy(
      policy,
      {
        action: "transfer_money",
        amount: 25000,
      },
      {
        action: "transfer_money",
        amount: 25000,
        balance: 20000,
        balance_after: -5000,
      },
    );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        (violation) =>
          violation.rule ===
          "sufficient_balance",
      ),
    ).toBe(true);
  });

  it("blocks minimum balance violation", async () => {
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
      result.violations.some(
        (violation) =>
          violation.rule ===
          "minimum_remaining_balance",
      ),
    ).toBe(true);
  });

  it("ignores rules for other actions", async () => {
    const result = await verifyPolicy(
      policy,
      {
        action: "read_balance",
      },
      {
        action: "read_balance",
        balance: 20000,
      },
    );

    expect(result.allowed).toBe(true);

    expect(result.violations).toEqual([]);
  });
});