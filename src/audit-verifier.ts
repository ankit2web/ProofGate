import { readFile } from "node:fs/promises";

import { verifyAuditChain } from "./audit-chain.js";

export async function verifyAuditLog(filePath = "audit/events.jsonl"): Promise<{
  valid: boolean;
  events: number;
}> {
  const contents = await readFile(filePath, "utf-8");

  const lines = contents.split("\n").filter((line) => line.trim().length > 0);

  const records = lines.map(
    (line) => JSON.parse(line) as Record<string, unknown>,
  );

  return {
    valid: verifyAuditChain(records),
    events: records.length,
  };
}
