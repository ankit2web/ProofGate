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

let shouldFailStore = false;

export function hashRequest(request: Record<string, unknown>): string {
  const canonicalRequest = JSON.stringify(request);

  return createHash("sha256").update(canonicalRequest, "utf8").digest("hex");
}

export function getExecution(
  idempotencyKey: string,
): StoredExecution | undefined {
  return executions.get(idempotencyKey);
}

export function getInFlightExecution(
  idempotencyKey: string,
): InFlightExecution | undefined {
  return inFlightExecutions.get(idempotencyKey);
}

export function storeExecution(
  idempotencyKey: string,
  execution: StoredExecution,
): void {
  if (shouldFailStore) {
    throw new Error("Idempotency store unavailable.");
  }

  executions.set(idempotencyKey, execution);
}

export function claimInFlightExecution(
  idempotencyKey: string,
  requestHash: string,
  promise: Promise<StoredExecution>,
): InFlightExecution | undefined {
  const existing = inFlightExecutions.get(idempotencyKey);

  // Someone else already owns this idempotency key.
  if (existing) {
    return existing;
  }

  // We become the owner.
  const inFlight: InFlightExecution = {
    requestHash,
    promise,
  };

  inFlightExecutions.set(idempotencyKey, inFlight);

  // Always clean up after completion.
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

export function resetIdempotencyStore(): void {
  executions.clear();
  inFlightExecutions.clear();
  shouldFailStore = false;
}

export function setIdempotencyStoreFailure(value: boolean): void {
  shouldFailStore = value;
}
