import {
  describe,
  expect,
  it,
} from "vitest";

import { getTool } from "../src/tool-registry.js";

describe("Tool Registry", () => {
  it("registers transfer_money", () => {
    const tool = getTool(
      "transfer_money",
    );

    expect(tool.name).toBe(
      "transfer_money",
    );
  });

  it("registers refund_payment", () => {
    const tool = getTool(
      "refund_payment",
    );

    expect(tool.name).toBe(
      "refund_payment",
    );
  });

  it("retrieves trusted payment state", async () => {
    const tool = getTool(
      "refund_payment",
    );

    const state =
      await tool.getTrustedState({
        action: "refund_payment",
        paymentId: "payment_001",
        amount: 2000,
      });

    expect(state).toEqual({
      payment_amount: 5000,
      payment_status: 1,
    });
  });

  it("calculates the proposed refund state", async () => {
    const tool = getTool(
      "refund_payment",
    );

    const trustedState =
      await tool.getTrustedState({
        action: "refund_payment",
        paymentId: "payment_001",
        amount: 2000,
      });

    const proposedState =
      tool.calculateAfterState(
        {
          action: "refund_payment",
          paymentId: "payment_001",
          amount: 2000,
        },
        trustedState,
      );

    expect(proposedState).toEqual({
      action: "refund_payment",
      paymentId: "payment_001",
      amount: 2000,
      payment_amount: 5000,
      payment_status: 1,
      refund_after: 3000,
    });
  });

  it("rejects an unknown tool", () => {
    expect(() =>
      getTool("does_not_exist"),
    ).toThrow(
      "Unknown tool: does_not_exist",
    );
  });
});