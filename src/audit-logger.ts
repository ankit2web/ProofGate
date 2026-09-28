import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";

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

async function getPreviousHash(): Promise<string> {
  try {
    const contents = await readFile("audit/events.jsonl", "utf-8");

    const lines = contents.split("\n").filter((line) => line.trim().length > 0);

    if (lines.length === 0) {
      return GENESIS_HASH;
    }

    const lastLine = lines[lines.length - 1];

    const lastRecord = JSON.parse(lastLine) as {
      event_hash?: unknown;
    };

    if (typeof lastRecord.event_hash !== "string") {
      throw new Error("Last audit record is missing event_hash.");
    }

    return getNextAuditHash(lastRecord.event_hash);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return GENESIS_HASH;
    }

    throw error;
  }
}

export async function writeAuditLog(event: AuditEvent): Promise<AuditRecord> {
  await mkdir("audit", {
    recursive: true,
  });

  const previousHash = await getPreviousHash();

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

  await appendFile(
    "audit/events.jsonl",
    JSON.stringify(record) + "\n",
    "utf-8",
  );

  return record;
}
