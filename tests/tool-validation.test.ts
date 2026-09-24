import { describe, expect, it } from "vitest";

import { getTool } from "../src/tool-registry.js";

describe("Tool Request Validation", () => {
  it("accepts a valid transfer request", () => {
    const tool = getTool("transfer_money");

    const request = tool.validateRequest({
      action: "transfer_money",
      amount: 5000,
    });

    expect(request).toEqual({
      action: "transfer_money",
      amount: 5000,
    });
  });

  it("rejects a transfer with a negative amount", () => {
    const tool = getTool("transfer_money");

    expect(() =>
      tool.validateRequest({
        action: "transfer_money",
        amount: -5000,
      }),
    ).toThrow();
  });

  it("rejects a transfer with zero amount", () => {
    const tool = getTool("transfer_money");

    expect(() =>
      tool.validateRequest({
        action: "transfer_money",
        amount: 0,
      }),
    ).toThrow();
  });

  it("rejects unexpected transfer fields", () => {
    const tool = getTool("transfer_money");

    expect(() =>
      tool.validateRequest({
        action: "transfer_money",
        amount: 5000,
        unexpected: "value",
      }),
    ).toThrow();
  });

  it("rejects a refund without paymentId", () => {
    const tool = getTool("refund_payment");

    expect(() =>
      tool.validateRequest({
        action: "refund_payment",
        amount: 2000,
      }),
    ).toThrow();
  });

  it("rejects a refund with zero amount", () => {
    const tool = getTool("refund_payment");

    expect(() =>
      tool.validateRequest({
        action: "refund_payment",
        paymentId: "payment_001",
        amount: 0,
      }),
    ).toThrow();
  });

  it("accepts a valid refund request", () => {
    const tool = getTool("refund_payment");

    const request = tool.validateRequest({
      action: "refund_payment",
      paymentId: "payment_001",
      amount: 2000,
    });

    expect(request).toEqual({
      action: "refund_payment",
      paymentId: "payment_001",
      amount: 2000,
    });
  });
});
