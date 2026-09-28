import { beforeEach, describe, expect, it } from "vitest";

import { readFile, mkdir } from "node:fs/promises";

import {
  setExternalInvoiceFailure,
  resetExternalInvoices,
} from "../src/external/invoice-service.js";

import { execute } from "../src/proofgate.js";

const auditFile = "audit/events.jsonl";

describe("External Invoice Audit", () => {
  beforeEach(async () => {
    await mkdir("audit", {
      recursive: true,
    });

    resetExternalInvoices();
  });

  it("records an allowed execution failure in the real audit log", async () => {
    const traceId = `external-invoice-audit-${Date.now()}`;

    setExternalInvoiceFailure(true);

    const result = await execute(
      {
        action: "create_invoice",
        amount: 20_000,
        currency: "INR",
        customerStatus: "active",
      },
      traceId,
    );

    expect(result.verification.allowed).toBe(true);
    expect(result.executed).toBe(false);

    expect(result.executionError).toBe("External invoice service unavailable.");

    const contents = await readFile(auditFile, "utf-8");

    const records = contents
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));

    const record = records.find((item) => item.traceId === traceId);

    expect(record).toBeDefined();

    expect(record).toMatchObject({
      traceId,
      decision: "ALLOW",
      executed: false,
      executionError: "External invoice service unavailable.",
    });
  });
});
