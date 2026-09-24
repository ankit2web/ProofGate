import { describe, expect, it, vi } from "vitest";

import * as stateProvider from "../src/state-provider.js";
import * as state from "../src/state.js";
import * as executor from "../src/tool-executor.js";

import { getTool } from "../src/tool-registry.js";

describe("Request Validation Boundary", () => {
  it("rejects an invalid transfer before trusted state retrieval", async () => {
    const getTrustedStateSpy = vi.spyOn(stateProvider, "getTrustedState");

    const tool = getTool("transfer_money");

    expect(() =>
      tool.validateRequest({
        action: "transfer_money",
        amount: -5000,
      }),
    ).toThrow();

    expect(getTrustedStateSpy).not.toHaveBeenCalled();

    getTrustedStateSpy.mockRestore();
  });

  it("rejects an invalid refund before trusted state retrieval", async () => {
    const getTrustedStateSpy = vi.spyOn(stateProvider, "getTrustedState");

    const tool = getTool("refund_payment");

    expect(() =>
      tool.validateRequest({
        action: "refund_payment",
        amount: 2000,
      }),
    ).toThrow();

    expect(getTrustedStateSpy).not.toHaveBeenCalled();

    getTrustedStateSpy.mockRestore();
  });

  it("does not execute an invalid transfer", () => {
    const executeToolSpy = vi.spyOn(executor, "executeTool");

    const tool = getTool("transfer_money");

    expect(() =>
      tool.validateRequest({
        action: "transfer_money",
        amount: 0,
      }),
    ).toThrow();

    expect(executeToolSpy).not.toHaveBeenCalled();

    executeToolSpy.mockRestore();
  });

  it("does not calculate state for an invalid refund", () => {
    const calculateAfterStateSpy = vi.spyOn(state, "calculateAfterState");

    const tool = getTool("refund_payment");

    expect(() =>
      tool.validateRequest({
        action: "refund_payment",
        amount: 1000,
      }),
    ).toThrow();

    expect(calculateAfterStateSpy).not.toHaveBeenCalled();

    calculateAfterStateSpy.mockRestore();
  });
});
