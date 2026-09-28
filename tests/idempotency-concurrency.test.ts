import { beforeEach, describe, expect, it } from "vitest";

import {
  getExternalInvoices,
  resetExternalInvoices,
  setExternalInvoiceExecutionDelay,
} from "../src/external/invoice-service.js";

import { resetIdempotencyStore } from "../src/idempotency-store.js";

import { execute } from "../src/proofgate.js";

describe("Idempotency concurrency", () => {
  beforeEach(() => {
    resetExternalInvoices();
    resetIdempotencyStore();
  });

  it("prevents concurrent requests from executing the same external action twice", async () => {
    setExternalInvoiceExecutionDelay(100);

    const request = {
      action: "create_invoice",
      amount: 20_000,
      currency: "INR",
      customerStatus: "active",
    };

    const [first, second] = await Promise.all([
      execute(request, "invoice-concurrent-1", {
        idempotencyKey: "invoice-concurrent-001",
      }),

      execute(request, "invoice-concurrent-2", {
        idempotencyKey: "invoice-concurrent-001",
      }),
    ]);

    expect(first.verification.allowed).toBe(true);
    expect(second.verification.allowed).toBe(true);

    expect(first.executed || second.executed).toBe(true);

    expect(getExternalInvoices()).toHaveLength(1);
  });
});
