import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { withAuditLock } from "./audit-lock.js";

import {
  GENESIS_HASH,
  getNextAuditHash,
  hashAuditEvent,
} from "./audit-chain.js";

export type AuditEvent = {
  traceId: string;

  request: Record<string, unknown>;

  trustedState: Record<string, unknown>;

  proposedState: Record<string, unknown>;

  policy: string;

  policyVersion: string;

  policyHash: string;

  decision: "ALLOW" | "BLOCK";

  violations: {
    rule: string;
    reason: string;
  }[];

  executed: boolean;

  replayed?: boolean;

  executionResult?: unknown;

  executionError?: string;
};

export type AuditRecord = AuditEvent & {
  id: string;

  timestamp: string;

  previous_hash: string;

  event_hash: string;
};

async function getPreviousHash(filePath: string): Promise<string> {
  try {
    const contents = await readFile(filePath, "utf-8");

    const lines = contents.split("\n").filter((line) => line.trim().length > 0);

    if (lines.length === 0) {
      return GENESIS_HASH;
    }

    const lastLine = lines.at(-1);

    if (lastLine === undefined) {
      return GENESIS_HASH;
    }

    const lastRecord = JSON.parse(lastLine) as {
      event_hash?: unknown;
    };

    const eventHash = lastRecord.event_hash;

    if (typeof eventHash !== "string") {
      throw new Error("Last audit record is missing event_hash.");
    }

    return getNextAuditHash(eventHash);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return GENESIS_HASH;
    }

    throw error;
  }
}

export async function writeAuditLogInternal(
  event: AuditEvent,
  filePath = "audit/events.jsonl",
): Promise<AuditRecord> {
  await mkdir("audit", {
    recursive: true,
  });

  const previousHash = await getPreviousHash(filePath);

  const recordWithoutHash = {
    id: randomUUID(),

    timestamp: new Date().toISOString(),

    ...event,
  };

  const eventHash = hashAuditEvent(recordWithoutHash, previousHash);

  const record: AuditRecord = {
    ...recordWithoutHash,

    previous_hash: previousHash,

    event_hash: eventHash,
  };

  await appendFile(filePath, JSON.stringify(record) + "\n", "utf-8");

  return record;
}

export function writeAuditLog(
  event: AuditEvent,
  filePath = "audit/events.jsonl",
): Promise<AuditRecord> {
  return withAuditLock(filePath, () => writeAuditLogInternal(event, filePath));
}
