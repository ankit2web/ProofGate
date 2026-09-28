import { createHash } from "node:crypto";

export const GENESIS_HASH = "GENESIS";

export type AuditChainRecord = {
  previous_hash: string;
  event_hash: string;
};

export function hashAuditEvent(
  event: Record<string, unknown>,
  previousHash: string,
): string {
  const payload = JSON.stringify({
    previous_hash: previousHash,
    event,
  });

  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function getNextAuditHash(previousHash: string | undefined): string {
  return previousHash ?? GENESIS_HASH;
}

export function verifyAuditEvent(
  event: Record<string, unknown>,
  record: AuditChainRecord,
): boolean {
  const expectedHash = hashAuditEvent(event, record.previous_hash);

  return expectedHash === record.event_hash;
}

export function verifyAuditChain(records: Record<string, unknown>[]): boolean {
  let previousHash = GENESIS_HASH;

  for (const record of records) {
    const { previous_hash, event_hash, ...event } = record as AuditChainRecord &
      Record<string, unknown>;

    if (previous_hash !== previousHash) {
      return false;
    }

    if (
      !verifyAuditEvent(event, {
        previous_hash,
        event_hash,
      })
    ) {
      return false;
    }

    previousHash = event_hash;
  }

  return true;
}
