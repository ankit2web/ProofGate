import { beforeEach, describe, expect, it } from "vitest";

import {
  getExternalInvoices,
  resetExternalInvoices,
  setExternalInvoiceFailure,
} from "../src/external/invoice-service.js";

import { execute } from "../src/proofgate.js";

describe("External Invoice Service", () => {
  beforeEach(() => {
    resetExternalInvoices();
  });

  it("calls the external service after successful verification", async () => {
    const result = await execute(
      {
        action: "create_invoice",
        amount: 20_000,
        currency: "INR",
        customerStatus: "active",
      },
      "external-invoice-allowed",
    );

    expect(result.verification.allowed).toBe(true);
    expect(result.executed).toBe(true);

    expect(getExternalInvoices()).toHaveLength(1);

    expect(getExternalInvoices()[0]).toMatchObject({
      amount: 20_000,
      currency: "INR",
    });
  });

  it("does not call the external service when verification blocks", async () => {
    const result = await execute(
      {
        action: "create_invoice",
        amount: 60_000,
        currency: "INR",
        customerStatus: "active",
      },
      "external-invoice-blocked",
    );

    expect(result.verification.allowed).toBe(false);
    expect(result.executed).toBe(false);

    expect(getExternalInvoices()).toHaveLength(0);
  });

  it("does not call the external service for an inactive customer", async () => {
    const result = await execute(
      {
        action: "create_invoice",
        amount: 20_000,
        currency: "INR",
        customerStatus: "inactive",
      },
      "external-invoice-inactive",
    );

    expect(result.verification.allowed).toBe(false);
    expect(result.executed).toBe(false);

    expect(getExternalInvoices()).toHaveLength(0);
  });

  it("reports an external execution failure after successful verification", async () => {
    setExternalInvoiceFailure(true);

    const result = await execute(
      {
        action: "create_invoice",
        amount: 20_000,
        currency: "INR",
        customerStatus: "active",
      },
      "external-invoice-failure",
    );

    expect(result.verification.allowed).toBe(true);
    expect(result.executed).toBe(false);

    expect(result.executionError).toBe("External invoice service unavailable.");

    expect(getExternalInvoices()).toHaveLength(0);
  });
});
