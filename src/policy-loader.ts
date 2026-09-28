import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import type { Policy } from "./policy-engine.js";

const PolicyRuleSchema = z
  .object({
    name: z.string().min(1),
    action: z.string().min(1),
    condition: z.string().min(1),
    effect: z.enum(["allow", "deny"]),
    reason: z.string().min(1),
  })
  .strict();

const PolicySchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    rules: z.array(PolicyRuleSchema).min(1),
  })
  .strict();

async function loadPolicyFile(filePath: string): Promise<Policy> {
  const raw = await readFile(filePath, "utf-8");

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid policy JSON: ${filePath}`);
  }

  const result = PolicySchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid policy schema: ${result.error.message}`);
  }

  return result.data;
}

export async function loadPolicyForAction(action: string): Promise<Policy> {
  const policiesDirectory = fileURLToPath(
    new URL("../policies/", import.meta.url),
  );

  const files = await readdir(policiesDirectory);

  const policyFiles = files.filter((file) => file.endsWith(".json"));

  for (const file of policyFiles) {
    const policy = await loadPolicyFile(join(policiesDirectory, file));

    const matchesAction = policy.rules.some((rule) => rule.action === action);

    if (matchesAction) {
      return policy;
    }
  }

  throw new Error(`No policy found for action: ${action}`);
}

/**
 * Backwards-compatible loader.
 *
 * Existing tests and callers can continue using
 * loadPolicy() while the application migrates to
 * action-based policy selection.
 */
export async function loadPolicy(): Promise<Policy> {
  return loadPolicyForAction("transfer_money");
}
