import { describe, expect, it } from "vitest";
import { execute, verify } from "../src/proofgate.js";

describe("Create Invoice Tool", () => {
  it("allows a valid invoice", async () => {
    const result = await verify(
      {
        action: "create_invoice",
        amount: 20_000,
        currency: "INR",
        customerStatus: "active",
      },
      "invoice-valid",
    );

    expect(result.verification.allowed).toBe(true);
    expect(result.verification.violations).toEqual([]);
    expect(result.executed).toBe(false);
  });

  it("blocks an invoice exceeding the amount limit", async () => {
    const result = await verify(
      {
        action: "create_invoice",
        amount: 60_000,
        currency: "INR",
        customerStatus: "active",
      },
      "invoice-too-large",
    );

    expect(result.verification.allowed).toBe(false);

    expect(
      result.verification.violations.some(
        (violation) => violation.rule === "invoice_amount_limit",
      ),
    ).toBe(true);

    expect(result.executed).toBe(false);
  });

  it("blocks an invoice for an inactive customer", async () => {
    const result = await verify(
      {
        action: "create_invoice",
        amount: 20_000,
        currency: "INR",
        customerStatus: "inactive",
      },
      "invoice-inactive-customer",
    );

    expect(result.verification.allowed).toBe(false);

    expect(
      result.verification.violations.some(
        (violation) => violation.rule === "customer_must_be_active",
      ),
    ).toBe(true);

    expect(result.executed).toBe(false);
  });

  it("blocks a non-INR invoice", async () => {
    const result = await verify(
      {
        action: "create_invoice",
        amount: 20_000,
        currency: "USD",
        customerStatus: "active",
      },
      "invoice-wrong-currency",
    );

    expect(result.verification.allowed).toBe(false);

    expect(
      result.verification.violations.some(
        (violation) => violation.rule === "currency_must_be_inr",
      ),
    ).toBe(true);

    expect(result.executed).toBe(false);
  });

  it("executes a valid invoice", async () => {
    const result = await execute(
      {
        action: "create_invoice",
        amount: 20_000,
        currency: "INR",
        customerStatus: "active",
      },
      "invoice-execute",
    );

    expect(result.verification.allowed).toBe(true);
    expect(result.executed).toBe(true);

    expect(result.executionResult).toMatchObject({
      success: true,
      amount: 20_000,
      currency: "INR",
    });
  });

  it("rejects caller-supplied trusted state", async () => {
    await expect(
      verify(
        {
          action: "create_invoice",
          amount: 20_000,
          currency: "INR",
          customerStatus: "inactive",
          customer_status: "active",
        },
        "invoice-forged-state",
      ),
    ).rejects.toThrow();
  });

  it("rejects an action with no matching policy", async () => {
    await expect(
      verify(
        {
          action: "unknown_tool",
        },
        "unknown-tool",
      ),
    ).rejects.toThrow("Unknown tool: unknown_tool");
  });
});
