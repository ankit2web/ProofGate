import { beforeEach, describe, expect, it } from "vitest";

import {
  getExternalInvoices,
  resetExternalInvoices,
} from "../src/external/invoice-service.js";

import { resetIdempotencyStore } from "../src/idempotency-store.js";

import { execute } from "../src/proofgate.js";

describe("External Invoice Idempotency", () => {
  beforeEach(() => {
    resetExternalInvoices();
    resetIdempotencyStore();
  });

  it("does not execute the external service twice for the same idempotency key", async () => {
    const request = {
      action: "create_invoice",
      amount: 20_000,
      currency: "INR",
      customerStatus: "active",
    };

    const first = await execute(request, "invoice-idempotency-first", {
      idempotencyKey: "invoice-create-001",
    });

    const second = await execute(request, "invoice-idempotency-second", {
      idempotencyKey: "invoice-create-001",
    });

    expect(first.executed).toBe(true);

    expect(second.executed).toBe(true);
    expect(second.replayed).toBe(true);

    expect(getExternalInvoices()).toHaveLength(1);

    expect(getExternalInvoices()[0]).toMatchObject({
      amount: 20_000,
      currency: "INR",
    });
  });

  it("rejects reuse of an idempotency key for a different request", async () => {
    await execute(
      {
        action: "create_invoice",
        amount: 20_000,
        currency: "INR",
        customerStatus: "active",
      },
      "invoice-idempotency-original",
      {
        idempotencyKey: "invoice-create-002",
      },
    );

    await expect(
      execute(
        {
          action: "create_invoice",
          amount: 30_000,
          currency: "INR",
          customerStatus: "active",
        },
        "invoice-idempotency-conflict",
        {
          idempotencyKey: "invoice-create-002",
        },
      ),
    ).rejects.toThrow(
      "Idempotency key has already been used for a different request.",
    );

    expect(getExternalInvoices()).toHaveLength(1);
  });
});
