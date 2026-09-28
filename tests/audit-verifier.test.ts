import { beforeEach, describe, expect, it } from "vitest";

import { appendFile, mkdir, readFile, rm } from "node:fs/promises";

import { writeAuditLog, type AuditEvent } from "../src/audit-logger.js";

import { verifyAuditLog } from "../src/audit-verifier.js";

const testAuditFile = "audit/test-events.jsonl";

const baseEvent: AuditEvent = {
  traceId: "test_trace",
  request: {
    action: "transfer_money",
    amount: 1000,
  },
  trustedState: {
    balance: 20000,
  },
  proposedState: {
    balance: 19000,
  },
  policy: "Financial Protection",
  policyVersion: "1.0.0",
  policyHash:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  decision: "ALLOW",
  violations: [],
  executed: true,
  replayed: false,
  executionResult: {
    success: true,
  },
};

describe("Audit Log Verifier", () => {
  beforeEach(async () => {
    await mkdir("audit", {
      recursive: true,
    });

    await rm(testAuditFile, {
      force: true,
    });
  });

  it("verifies audit events written by the real logger", async () => {
    await writeAuditLog(baseEvent, testAuditFile);

    await writeAuditLog(
      {
        ...baseEvent,
        traceId: "test_trace_2",
        request: {
          action: "transfer_money",
          amount: 2000,
        },
      },
      testAuditFile,
    );

    const result = await verifyAuditLog(testAuditFile);

    expect(result.valid).toBe(true);
    expect(result.events).toBe(2);
  });

  it("detects tampering in the real audit file", async () => {
    await writeAuditLog(baseEvent, testAuditFile);

    const contents = await readFile(testAuditFile, "utf-8");

    const tamperedContents = contents.replace('"amount":1000', '"amount":9999');

    await rm(testAuditFile);

    await appendFile(testAuditFile, tamperedContents, "utf-8");

    const result = await verifyAuditLog(testAuditFile);

    expect(result.valid).toBe(false);
    expect(result.events).toBe(1);
  });
});
