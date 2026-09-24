import { getZ3 } from "./z3.js";
import { compileConstraint } from "./constraint-compiler.js";

export type PolicyRule = {
  name: string;
  action: string;
  condition: string;
  effect: "allow" | "deny";
  reason: string;
};

export type Policy = {
  name: string;
  rules: PolicyRule[];
};

export type VerificationResult = {
  allowed: boolean;
  violations: {
    rule: string;
    reason: string;
  }[];
};

export async function verifyPolicy(
  policy: Policy,
  request: Record<string, unknown>,
  proposedState: Record<string, unknown>,
): Promise<VerificationResult> {
  const { Context } = await getZ3();

  const Z3 = Context("main");

  const solver = new Z3.Solver();

  const violations: {
    rule: string;
    reason: string;
  }[] = [];

  console.log("");
  console.log("########################################");
  console.log("🔥 POLICY ENGINE");
  console.log("Request:", request);
  console.log("Proposed State:", proposedState);
  console.log("########################################");

  for (const rule of policy.rules) {
    if (rule.action !== request.action) {
      continue;
    }

    console.log("");
    console.log(`[ProofGate] Checking rule: ${rule.name}`);
    console.log(`[ProofGate] Condition: ${rule.condition}`);
    console.log(`[ProofGate] Effect: ${rule.effect}`);

    const constraint = compileConstraint(
      Z3,
      rule.condition,
      proposedState,
    );

    /*
     * Bind every numeric value in the proposed state
     * to its corresponding Z3 variable.
     */
    for (const [key, value] of Object.entries(
      proposedState,
    )) {
      if (typeof value === "number") {
        solver.add(
          Z3.Real.const(key).eq(
            Z3.Real.val(value),
          ),
        );
      }
    }

    solver.push();

    solver.add(constraint);

    const result = await solver.check();

    const resultStatus = result.toString();

    console.log(
      `[ProofGate] Rule "${rule.name}" → ${resultStatus}`,
    );

    solver.pop();

    /*
     * Allow rule:
     *
     * SAT   = condition is satisfied
     * UNSAT = condition is violated
     */
    if (rule.effect === "allow") {
      if (resultStatus === "unsat") {
        violations.push({
          rule: rule.name,
          reason: rule.reason,
        });
      }
    }

    /*
     * Deny rule:
     *
     * SAT = forbidden condition is true
     */
    if (rule.effect === "deny") {
      if (resultStatus === "sat") {
        violations.push({
          rule: rule.name,
          reason: rule.reason,
        });
      }
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
  };
}