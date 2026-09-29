import { createHash } from "node:crypto";

export type StoredExecution = {
  requestHash: string;
  result: unknown;
};

type InFlightExecution = {
  requestHash: string;
  promise: Promise<StoredExecution>;
};

const executions = new Map<string, StoredExecution>();

const inFlightExecutions = new Map<string, InFlightExecution>();

export function hashRequest(request: Record<string, unknown>): string {
  const canonicalRequest = JSON.stringify(request);

  return createHash("sha256").update(canonicalRequest, "utf8").digest("hex");
}

export function getExecution(idempotencyKey: string) {
  return executions.get(idempotencyKey);
}

export function getInFlightExecution(idempotencyKey: string) {
  return inFlightExecutions.get(idempotencyKey);
}

export function storeExecution(
  idempotencyKey: string,
  execution: StoredExecution,
) {
  if (shouldFailStore) {
    throw new Error("Idempotency store unavailable.");
  }

  executions.set(idempotencyKey, execution);
}

export function claimInFlightExecution(
  idempotencyKey: string,
  requestHash: string,
  promise: Promise<StoredExecution>,
) {
  const existing = inFlightExecutions.get(idempotencyKey);

  if (existing) {
    return existing;
  }

  inFlightExecutions.set(idempotencyKey, {
    requestHash,
    promise,
  });

  void promise.then(
    () => {
      const current = inFlightExecutions.get(idempotencyKey);

      if (current?.promise === promise) {
        inFlightExecutions.delete(idempotencyKey);
      }
    },
    () => {
      const current = inFlightExecutions.get(idempotencyKey);

      if (current?.promise === promise) {
        inFlightExecutions.delete(idempotencyKey);
      }
    },
  );

  return undefined;
}

export function resetIdempotencyStore() {
  executions.clear();
  inFlightExecutions.clear();
  shouldFailStore = false;
}

let shouldFailStore = false;

export function setIdempotencyStoreFailure(value: boolean) {
  shouldFailStore = value;
}
