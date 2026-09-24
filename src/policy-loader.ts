import { readFile } from "node:fs/promises";
import type { Policy } from "./policy-engine.js";

const PolicyRuleSchema = {
  name: "string",
  action: "string",
  condition: "string",
  effect: "allow | deny",
  reason: "string",
};

export async function loadPolicy(): Promise<Policy> {
  const raw = await readFile(
    new URL("../policies/database.json", import.meta.url),
    "utf-8",
  );

  const policy = JSON.parse(raw);

  return policy as Policy;
}