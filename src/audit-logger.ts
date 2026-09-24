import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";

export type AuditEvent = {
  traceId: string;

  request: Record<string, unknown>;

  trustedState: Record<string, unknown>;

  proposedState: Record<string, unknown>;

  policy: string;

  decision: "ALLOW" | "BLOCK";

  violations: {
    rule: string;
    reason: string;
  }[];

  executed: boolean;

  executionResult?: unknown;

  executionError?: string;
};

export async function writeAuditLog(
  event: AuditEvent,
) {
  await mkdir("audit", {
    recursive: true,
  });

  const record = {
    id: randomUUID(),

    timestamp: new Date().toISOString(),

    ...event,
  };

  await appendFile(
    "audit/events.jsonl",
    JSON.stringify(record) + "\n",
    "utf-8",
  );

  return record;
}