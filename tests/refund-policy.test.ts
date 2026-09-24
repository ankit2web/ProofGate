import {
  describe,
  expect,
  it,
} from "vitest";

import {
  verifyPolicy,
  type Policy,
} from "../src/policy-engine.js";

import { getTool } from "../src/tool-registry.js";

describe("Refund Policy", () => {
  const policy: Policy = {
    name: "Financial Protection",

    rules: [
      {
        name: "refund_limit",
        action: "refund_payment",
        condition: "amount <= payment_amount",
        effect: "allow",
        reason:
          "Refund cannot exceed the original payment amount.",
      },
      {
        name: "payment_must_be_paid",
        action: "refund_payment",
        condition: "payment_status == 1",
        effect: "allow",
        reason:
          "Only paid payments can be refunded.",
      },
    ],
  };

  it("allows a valid refund", async () => {
    const tool = getTool(
      "refund_payment",
    );

    const request = {
      action: "refund_payment",
      paymentId: "payment_001",
      amount: 2000,
    };

    const trustedState =
      await tool.getTrustedState(request);

    const proposedState =
      tool.calculateAfterState(
        request,
        trustedState,
      );

    const result =
      await verifyPolicy(
        policy,
        request,
        proposedState,
      );

    expect(result.allowed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("blocks a refund larger than the payment", async () => {
    const tool = getTool(
      "refund_payment",
    );

    const request = {
      action: "refund_payment",
      paymentId: "payment_001",
      amount: 6000,
    };

    const trustedState =
      await tool.getTrustedState(request);

    const proposedState =
      tool.calculateAfterState(
        request,
        trustedState,
      );

    const result =
      await verifyPolicy(
        policy,
        request,
        proposedState,
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "refund_limit",
        }),
      ]),
    );
  });

  it("blocks a refund for an already refunded payment", async () => {
    const tool = getTool(
      "refund_payment",
    );

    const request = {
      action: "refund_payment",
      paymentId: "payment_003",
      amount: 1000,
    };

    const trustedState =
      await tool.getTrustedState(request);

    const proposedState =
      tool.calculateAfterState(
        request,
        trustedState,
      );

    const result =
      await verifyPolicy(
        policy,
        request,
        proposedState,
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "payment_must_be_paid",
        }),
      ]),
    );
  });
});