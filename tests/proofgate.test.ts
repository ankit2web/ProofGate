import { beforeEach, describe, expect, it, vi } from "vitest";
import { execute, verify } from "../src/proofgate.js";
import * as executor from "../src/tool-executor.js";
import { resetBank, transfer } from "../src/fake-bank.js";

describe("ProofGate Pipeline", () => {
  const traceId = "pg_test_123";

  beforeEach(() => {
    vi.restoreAllMocks();
    resetBank();
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

  it("rejects execution when trusted bank state becomes stale", async () => {
    const verified = await verify(
      {
        action: "transfer_money",
        amount: 5000,
      },
      traceId,
    );

    expect(verified.verification.allowed).toBe(true);

    expect(verified.trustedState).toEqual({
      balance: 20000,
      state_version: 1,
    });

    // Another transaction changes the bank.
    transfer(15000);

    expect(
      await import("../src/fake-bank.js").then((bank) => bank.getBankState()),
    ).toEqual({
      balance: 5000,
      state_version: 2,
    });

    // Try to execute using the stale state from ProofGate verification.
    await expect(
      executor.executeTool(
        verified.request as {
          action: string;
          amount: number;
        },
        verified.trustedState,
      ),
    ).rejects.toThrow("Bank state changed after verification");
  });

  it("passes the verified trusted state to execution", async () => {
    const executeToolSpy = vi.spyOn(executor, "executeTool").mockResolvedValue({
      success: true,
    });

    const result = await execute(
      {
        action: "transfer_money",
        amount: 5000,
      },
      traceId,
    );

    expect(result.verification.allowed).toBe(true);
    expect(result.executed).toBe(true);

    expect(executeToolSpy).toHaveBeenCalledWith(
      {
        action: "transfer_money",
        amount: 5000,
      },
      {
        balance: 20000,
        state_version: 1,
      },
    );
  });
});
