import Fastify from "fastify";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { init } from "z3-solver";

import { compileConstraint } from "./constraint-compiler.js";
import { calculateAfterState } from "./state.js";
import { executeTool } from "./tool-executor.js";
import { getTrustedState } from "./state-provider.js";

const app = Fastify({
  logger: true,
});

/*
 * ============================================================
 * Request Schema
 * ============================================================
 */

const ActionRequest = z
  .object({
    action: z.string(),

    environment: z
      .enum(["development", "staging", "production"])
      .optional(),

    amount: z.number().optional(),
  })
  .strict();

/*
 * ============================================================
 * Policy Schema
 * ============================================================
 */

const Rule = z.object({
  name: z.string(),
  action: z.string(),
  condition: z.string(),
  effect: z.enum(["allow", "deny"]),
  reason: z.string(),
});

const Policy = z.object({
  name: z.string(),
  rules: z.array(Rule),
});

/*
 * ============================================================
 * Load Policy
 * ============================================================
 */

async function loadPolicy() {
  const raw = await readFile(
    "./policies/database.json",
    "utf8",
  );

  const policy = JSON.parse(raw);

  return Policy.parse(policy);
}

/*
 * ============================================================
 * Verify With Z3
 * ============================================================
 */

async function verifyWithZ3(
  request: Record<string, unknown>,
  policy: z.infer<typeof Policy>,
) {
  /*
   * VERY OBVIOUS DEBUG MARKER
   *
   * If this appears in the terminal, we know this function
   * is definitely being executed.
   */
  console.log("");
  console.log("########################################");
  console.log("🔥 VERIFY WITH Z3 WAS CALLED");
  console.log("Request:", request);
  console.log("########################################");
  console.log("");

  const { Context } = await init();

  const Z3 = Context("main");

  const violations: Array<{
    rule: string;
    reason: string;
  }> = [];

  for (const rule of policy.rules) {
    /*
     * Only apply rules belonging to this action.
     */
    if (rule.action !== request.action) {
      continue;
    }

    console.log(
      `[ProofGate] Evaluating rule: ${rule.name}`,
    );

    console.log(
      `[ProofGate] Condition: ${rule.condition}`,
    );

    const solver = new Z3.Solver();

    /*
     * Compile policy condition into a Z3 constraint.
     */
    const constraint = compileConstraint(
      Z3,
      rule.condition,
      request,
    );

    /*
     * Bind numeric request/state values.
     */
    for (const [name, value] of Object.entries(request)) {
      if (typeof value === "number") {
        const variable = Z3.Real.const(name);

        solver.add(
          variable.eq(
            Z3.Real.val(value),
          ),
        );
      }
    }

    /*
     * Add policy constraint.
     */
    solver.add(constraint);

    /*
     * Ask Z3 whether the constraint is satisfiable.
     */
    const result = await solver.check();

    /*
     * Convert Z3 result to a normal string.
     */
    const resultStatus = result.toString();

    /*
     * VERY EXPLICIT DEBUG OUTPUT
     */
    console.log(
      `[ProofGate] Rule "${rule.name}" → ${resultStatus}`,
    );

    console.log(
      `[ProofGate] Values:`,
      request,
    );

    /*
     * ========================================================
     * ALLOW RULE
     * ========================================================
     *
     * SAT   = condition is true
     * UNSAT = condition is false
     *
     * Therefore:
     *
     * UNSAT → violation
     */
    if (rule.effect === "allow") {
      if (resultStatus === "unsat") {
        console.log(
          `[ProofGate] ❌ VIOLATION: ${rule.name}`,
        );

        violations.push({
          rule: rule.name,
          reason: rule.reason,
        });
      } else {
        console.log(
          `[ProofGate] ✅ PASSED: ${rule.name}`,
        );
      }
    }

    /*
     * ========================================================
     * DENY RULE
     * ========================================================
     *
     * SAT = forbidden condition is true
     *
     * Therefore:
     *
     * SAT → violation
     */
    if (rule.effect === "deny") {
      if (resultStatus === "sat") {
        console.log(
          `[ProofGate] ❌ DENIED RULE TRIGGERED: ${rule.name}`,
        );

        violations.push({
          rule: rule.name,
          reason: rule.reason,
        });
      } else {
        console.log(
          `[ProofGate] ✅ DENY RULE PASSED: ${rule.name}`,
        );
      }
    }
  }

  console.log("");
  console.log(
    `[ProofGate] Total violations: ${violations.length}`,
  );

  console.log(
    `[ProofGate] Allowed: ${violations.length === 0}`,
  );

  console.log("");

  return {
    allowed: violations.length === 0,
    violations,
  };
}

/*
 * ============================================================
 * Health Check
 * ============================================================
 */

app.get("/", async () => {
  return {
    name: "ProofGate",
    status: "running",
  };
});

/*
 * ============================================================
 * VERIFY
 * ============================================================
 */

app.post("/verify", async (request, reply) => {
  console.log("");
  console.log("[ProofGate] POST /verify");

  const result = ActionRequest.safeParse(
    request.body,
  );

  /*
   * Reject invalid requests.
   */
  if (!result.success) {
    console.log(
      "[ProofGate] ❌ Request validation failed",
    );

    return reply.code(400).send({
      verified: false,
      error: result.error,
    });
  }

  console.log(
    "[ProofGate] Request validated:",
    result.data,
  );

  /*
   * Load policy.
   */
  const policy = await loadPolicy();

  console.log(
    `[ProofGate] Loaded policy: ${policy.name}`,
  );

  /*
   * Get trusted state.
   *
   * IMPORTANT:
   *
   * The caller does NOT provide the balance.
   */
  const trustedState = await getTrustedState(
    result.data,
  );

  console.log(
    "[ProofGate] Trusted state:",
    trustedState,
  );

  /*
   * Calculate proposed state.
   */
  const proposedState = calculateAfterState(
    result.data,
    trustedState,
  );

  console.log(
    "[ProofGate] Proposed state:",
    proposedState,
  );

  /*
   * Verify with Z3.
   */
  const verification = await verifyWithZ3(
    proposedState,
    policy,
  );

  console.log(
    "[ProofGate] Verification result:",
    verification,
  );

  return {
    verified: true,

    request: result.data,

    trustedState,

    proposedState,

    policy: policy.name,

    verification,
  };
});

/*
 * ============================================================
 * EXECUTE
 * ============================================================
 */

app.post("/execute", async (request, reply) => {
  console.log("");
  console.log("[ProofGate] POST /execute");

  const result = ActionRequest.safeParse(
    request.body,
  );

  /*
   * Reject malformed requests.
   */
  if (!result.success) {
    console.log(
      "[ProofGate] ❌ Request validation failed",
    );

    return reply.code(400).send({
      executed: false,
      verified: false,
      error: result.error,
    });
  }

  console.log(
    "[ProofGate] Request validated:",
    result.data,
  );

  /*
   * Load policy.
   */
  const policy = await loadPolicy();

  console.log(
    `[ProofGate] Loaded policy: ${policy.name}`,
  );

  /*
   * Get trusted state.
   */
  const trustedState = await getTrustedState(
    result.data,
  );

  console.log(
    "[ProofGate] Trusted state:",
    trustedState,
  );

  /*
   * Calculate proposed state.
   */
  const proposedState = calculateAfterState(
    result.data,
    trustedState,
  );

  console.log(
    "[ProofGate] Proposed state:",
    proposedState,
  );

  /*
   * Verify BEFORE execution.
   */
  const verification = await verifyWithZ3(
    proposedState,
    policy,
  );

  /*
   * ==========================================================
   * SECURITY BOUNDARY
   * ==========================================================
   */

  if (!verification.allowed) {
    console.log(
      "[ProofGate] 🛑 ACTION BLOCKED",
    );

    return reply.code(403).send({
      executed: false,
      verified: false,

      trustedState,

      proposedState,

      violations: verification.violations,
    });
  }

  /*
   * ==========================================================
   * EXECUTION
   * ==========================================================
   */

  console.log(
    "[ProofGate] ✅ ACTION VERIFIED — EXECUTING",
  );

  try {
    const {
      action,
      environment,
      amount,
    } = result.data;

    const executionResult = await executeTool({
      action,

      ...(environment === undefined
        ? {}
        : { environment }),

      ...(amount === undefined
        ? {}
        : { amount }),
    });

    console.log(
      "[ProofGate] Execution result:",
      executionResult,
    );

    return {
      executed: true,
      verified: true,

      trustedState,

      proposedState,

      result: executionResult,
    };
  } catch (error) {
    console.log(
      "[ProofGate] ❌ Tool execution failed:",
      error,
    );

    return reply.code(500).send({
      executed: false,
      verified: true,

      error:
        error instanceof Error
          ? error.message
          : "Tool execution failed.",
    });
  }
});

/*
 * ============================================================
 * Start Server
 * ============================================================
 */

async function start() {
  try {
    await app.listen({
      host: "127.0.0.1",
      port: 3000,
    });

    console.log("");
    console.log(
      "🚀 ProofGate running at http://127.0.0.1:3000",
    );
    console.log("");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();