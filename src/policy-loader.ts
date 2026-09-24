import { readFile } from "node:fs/promises";
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

export async function loadPolicy(): Promise<Policy> {
  const raw = await readFile(
    new URL("../policies/database.json", import.meta.url),
    "utf-8",
  );

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid policy JSON.");
  }

  const result = PolicySchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid policy schema: ${result.error.message}`);
  }

  return result.data;
}
