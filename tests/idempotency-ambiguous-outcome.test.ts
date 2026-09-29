import { beforeEach, describe, expect, it } from "vitest";

import {
  getExternalInvoices,
  resetExternalInvoices,
} from "../src/external/invoice-service.js";

import {
  resetIdempotencyStore,
  setIdempotencyStoreFailure,
} from "../src/idempotency-store.js";

import { execute } from "../src/proofgate.js";

describe("Idempotency ambiguous outcome", () => {
  beforeEach(() => {
    resetExternalInvoices();
    resetIdempotencyStore();
  });

  it("demonstrates the ambiguous outcome when result persistence fails", async () => {
    setIdempotencyStoreFailure(true);

    const request = {
      action: "create_invoice",
      amount: 20_000,
      currency: "INR",
      customerStatus: "active",
    };

    await expect(
      execute(request, "invoice-ambiguous-1", {
        idempotencyKey: "invoice-ambiguous-001",
      }),
    ).rejects.toThrow("Idempotency store unavailable.");

    /*
     * The external side effect already happened even though
     * ProofGate returned an error.
     */
    expect(getExternalInvoices()).toHaveLength(1);

    setIdempotencyStoreFailure(false);

    /*
     * The idempotency record was never persisted.
     *
     * Therefore a retry currently executes the external
     * operation again.
     */
    const second = await execute(request, "invoice-ambiguous-2", {
      idempotencyKey: "invoice-ambiguous-001",
    });

    expect(second.executed).toBe(true);

    expect(second.executionResult).toMatchObject({
      invoiceId: "external_invoice_1",
    });

    expect(getExternalInvoices()).toHaveLength(1);
  });
});
