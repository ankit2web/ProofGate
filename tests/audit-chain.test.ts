import { describe, expect, it } from "vitest";

import {
  getNextAuditHash,
  hashAuditEvent,
  verifyAuditEvent,
} from "../src/audit-chain.js";

describe("Audit Chain", () => {
  it("generates a deterministic hash", () => {
    const event = {
      action: "transfer_money",
      amount: 5000,
    };

    const hash1 = hashAuditEvent(event, "GENESIS");

    const hash2 = hashAuditEvent(event, "GENESIS");

    expect(hash1).toBe(hash2);
  });

  it("changes when the event changes", () => {
    const hash1 = hashAuditEvent(
      {
        action: "transfer_money",
        amount: 5000,
      },
      "GENESIS",
    );

    const hash2 = hashAuditEvent(
      {
        action: "transfer_money",
        amount: 6000,
      },
      "GENESIS",
    );

    expect(hash1).not.toBe(hash2);
  });

  it("changes when the previous hash changes", () => {
    const event = {
      action: "transfer_money",
      amount: 5000,
    };

    const hash1 = hashAuditEvent(event, "GENESIS");

    const hash2 = hashAuditEvent(event, "different_previous_hash");

    expect(hash1).not.toBe(hash2);
  });

  it("produces a SHA-256 hash", () => {
    const hash = hashAuditEvent(
      {
        action: "transfer_money",
        amount: 5000,
      },
      "GENESIS",
    );

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses GENESIS when there is no previous hash", () => {
    expect(getNextAuditHash(undefined)).toBe("GENESIS");
  });

  it("uses the previous event hash when available", () => {
    expect(getNextAuditHash("abc123")).toBe("abc123");
  });

  it("verifies an untampered audit event", () => {
    const event = {
      action: "transfer_money",
      amount: 5000,
    };

    const previousHash = "GENESIS";

    const eventHash = hashAuditEvent(event, previousHash);

    expect(
      verifyAuditEvent(event, {
        previous_hash: previousHash,
        event_hash: eventHash,
      }),
    ).toBe(true);
  });

  it("detects a tampered audit event", () => {
    const originalEvent = {
      action: "transfer_money",
      amount: 5000,
    };

    const tamperedEvent = {
      action: "transfer_money",
      amount: 9000,
    };

    const previousHash = "GENESIS";

    const eventHash = hashAuditEvent(originalEvent, previousHash);

    expect(
      verifyAuditEvent(tamperedEvent, {
        previous_hash: previousHash,
        event_hash: eventHash,
      }),
    ).toBe(false);
  });
});
