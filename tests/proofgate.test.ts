import { beforeEach, describe, expect, it, vi } from "vitest";

import { execute, verify } from "../src/proofgate.js";

import * as executor from "../src/tool-executor.js";

describe("ProofGate Pipeline", () => {
  const traceId = "pg_test_123";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies a valid transfer", async () => {
    const result = await verify(
      {
        action: "transfer_money",
        amount: 5000,
      },
      traceId,
    );

    expect(result.traceId).toBe(traceId);

    expect(result.verification.allowed).toBe(true);

    expect(result.verification.violations).toEqual([]);

    expect(result.executed).toBe(false);

    expect(result.policy.name).toBe("Financial Protection");

    expect(result.policy.version).toBe("1.0.0");

    expect(result.policy.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("blocks an invalid transfer", async () => {
    const result = await verify(
      {
        action: "transfer_money",
        amount: 15000,
      },
      traceId,
    );

    expect(result.verification.allowed).toBe(false);

    expect(result.verification.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "transfer_limit",
        }),
      ]),
    );

    expect(result.executed).toBe(false);
  });

  it("executes an allowed transfer", async () => {
    const executeToolSpy = vi.spyOn(executor, "executeTool");

    const result = await execute(
      {
        action: "transfer_money",
        amount: 1000,
      },
      traceId,
    );

    expect(result.verification.allowed).toBe(true);

    expect(result.executed).toBe(true);

    expect(result.executionResult).toBeDefined();

    expect(executeToolSpy).toHaveBeenCalledTimes(1);
  });

  it("does not execute a blocked transfer", async () => {
    const executeToolSpy = vi.spyOn(executor, "executeTool");

    const result = await execute(
      {
        action: "transfer_money",
        amount: 15000,
      },
      traceId,
    );

    expect(result.verification.allowed).toBe(false);

    expect(result.executed).toBe(false);

    expect(executeToolSpy).not.toHaveBeenCalled();
  });

  it("rejects an invalid tool request before verification", async () => {
    await expect(
      verify(
        {
          action: "refund_payment",
          amount: 2000,
        },
        traceId,
      ),
    ).rejects.toThrow();
  });
});
