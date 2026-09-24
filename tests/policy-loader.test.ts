import { describe, expect, it } from "vitest";

import { loadPolicy } from "../src/policy-loader.js";

describe("Policy Loader", () => {
  it("loads and validates the database policy", async () => {
    const policy = await loadPolicy();

    expect(policy.name).toBe("Financial Protection");

    expect(policy.rules.length).toBeGreaterThan(0);
  });

  it("loads rules with the expected structure", async () => {
    const policy = await loadPolicy();

    for (const rule of policy.rules) {
      expect(rule.name).toEqual(expect.any(String));

      expect(rule.action).toEqual(expect.any(String));

      expect(rule.condition).toEqual(expect.any(String));

      expect(["allow", "deny"]).toContain(rule.effect);

      expect(rule.reason).toEqual(expect.any(String));
    }
  });
});
