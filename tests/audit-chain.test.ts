import { describe, expect, it } from "vitest";

import {
  GENESIS_HASH,
  getNextAuditHash,
  hashAuditEvent,
  verifyAuditChain,
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

  it("verifies a valid audit chain", () => {
    const firstEvent = {
      id: "event_1",
      action: "transfer_money",
      amount: 1000,
    };

    const firstHash = hashAuditEvent(firstEvent, GENESIS_HASH);

    const secondEvent = {
      id: "event_2",
      action: "transfer_money",
      amount: 2000,
    };

    const secondHash = hashAuditEvent(secondEvent, firstHash);

    const records = [
      {
        ...firstEvent,
        previous_hash: GENESIS_HASH,
        event_hash: firstHash,
      },
      {
        ...secondEvent,
        previous_hash: firstHash,
        event_hash: secondHash,
      },
    ];

    expect(verifyAuditChain(records)).toBe(true);
  });

  it("detects a tampered audit event", () => {
    const event = {
      id: "event_1",
      action: "transfer_money",
      amount: 1000,
    };

    const eventHash = hashAuditEvent(event, GENESIS_HASH);

    const records = [
      {
        ...event,
        amount: 9000,
        previous_hash: GENESIS_HASH,
        event_hash: eventHash,
      },
    ];

    expect(verifyAuditChain(records)).toBe(false);
  });

  it("detects a broken audit chain link", () => {
    const firstEvent = {
      id: "event_1",
      action: "transfer_money",
      amount: 1000,
    };

    const firstHash = hashAuditEvent(firstEvent, GENESIS_HASH);

    const secondEvent = {
      id: "event_2",
      action: "transfer_money",
      amount: 2000,
    };

    const secondHash = hashAuditEvent(secondEvent, firstHash);

    const records = [
      {
        ...firstEvent,
        previous_hash: GENESIS_HASH,
        event_hash: firstHash,
      },
      {
        ...secondEvent,
        previous_hash: "tampered_previous_hash",
        event_hash: secondHash,
      },
    ];

    expect(verifyAuditChain(records)).toBe(false);
  });

  it("detects a tampered event hash", () => {
    const event = {
      id: "event_1",
      action: "transfer_money",
      amount: 1000,
    };

    const records = [
      {
        ...event,
        previous_hash: GENESIS_HASH,
        event_hash: "tampered_hash",
      },
    ];

    expect(verifyAuditChain(records)).toBe(false);
  });

  it("accepts an empty audit chain", () => {
    expect(verifyAuditChain([])).toBe(true);
  });
});
