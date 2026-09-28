import { createHash } from "node:crypto";

export type StoredExecution = {
  requestHash: string;
  result: unknown;
};

const executions = new Map<string, StoredExecution>();

export function hashRequest(request: Record<string, unknown>): string {
  const canonicalRequest = JSON.stringify(request);

  return createHash("sha256").update(canonicalRequest, "utf8").digest("hex");
}

export function getExecution(idempotencyKey: string) {
  return executions.get(idempotencyKey);
}

export function storeExecution(
  idempotencyKey: string,
  execution: StoredExecution,
) {
  executions.set(idempotencyKey, execution);
}

export function resetIdempotencyStore() {
  executions.clear();
}
