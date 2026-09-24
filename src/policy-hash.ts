import { createHash } from "node:crypto";

import type { Policy } from "./policy-engine.js";

export function hashPolicy(policy: Policy): string {
  const canonicalPolicy = JSON.stringify(policy);

  return createHash("sha256").update(canonicalPolicy, "utf8").digest("hex");
}
