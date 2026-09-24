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
 *
 * The caller/LLM is allowed to provide the action and its
 * parameters.
 *
 * IMPORTANT:
 * State such as "balance" is NOT accepted from the caller.
 * ProofGate retrieves trusted state itself.
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
  const { Context } = await init();

  const Z3 = Context("main");

  const violations: Array<{
    rule: string;
    reason: string;
  }> = [];

  for (const rule of policy.rules) {
    /*
     * Only apply rules that belong to this action.
     */
    if (rule.action !== request.action) {
      continue;
    }

    const solver = new Z3.Solver();

    /*
     * Compile the policy condition into a Z3 constraint.
     */
    const constraint = compileConstraint(
      Z3,
      rule.condition,
      request,
    );

    /*
     * Bind numeric values from the trusted/proposed state
     * to concrete Z3 values.
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

    solver.add(constraint);

    const result = await solver.check();

    const resultStatus = result.toString();

    /*
     * For an allow rule:
     *
     * SAT    = condition is satisfied
     * UNSAT  = condition is violated
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
     * For a deny rule:
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
 *
 * This endpoint verifies an action without executing it.
 *
 * Flow:
 *
 * Request
 *   ↓
 * Validate request
 *   ↓
 * Load policy
 *   ↓
 * Get trusted state
 *   ↓
 * Calculate proposed state
 *   ↓
 * Z3 verification
 *   ↓
 * Return result
 */

app.post("/verify", async (request, reply) => {
  const result = ActionRequest.safeParse(
    request.body,
  );

  if (!result.success) {
    return reply.code(400).send({
      verified: false,
      error: result.error,
    });
  }

  const policy = await loadPolicy();

  /*
   * IMPORTANT:
   *
   * We do NOT use state supplied by the caller.
   *
   * ProofGate retrieves the state itself.
   */
  const trustedState = await getTrustedState(
    result.data,
  );

  /*
   * Calculate what the state would look like
   * if this action were executed.
   */
  const proposedState = calculateAfterState(
    result.data,
    trustedState,
  );

  /*
   * Verify the proposed state against policy.
   */
  const verification = await verifyWithZ3(
    proposedState,
    policy,
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
 *
 * This is the security boundary.
 *
 * Flow:
 *
 * LLM/tool request
 *       ↓
 *   Validate
 *       ↓
 * Trusted state
 *       ↓
 * Proposed state
 *       ↓
 *      Z3
 *       ↓
 * ┌─────┴─────┐
 * ↓           ↓
 * BLOCK      ALLOW
 *             ↓
 *          Execute
 */

app.post("/execute", async (request, reply) => {
  const result = ActionRequest.safeParse(
    request.body,
  );

  /*
   * Reject malformed or unauthorized request fields.
   */
  if (!result.success) {
    return reply.code(400).send({
      executed: false,
      verified: false,
      error: result.error,
    });
  }

  /*
   * Load policies.
   */
  const policy = await loadPolicy();

  /*
   * Get state from a trusted source.
   *
   * NEVER trust balance/state supplied by the LLM.
   */
  const trustedState = await getTrustedState(
    result.data,
  );

  /*
   * Calculate the state after the proposed action.
   */
  const proposedState = calculateAfterState(
    result.data,
    trustedState,
  );

  /*
   * Verify BEFORE execution.
   */
  const verification = await verifyWithZ3(
    proposedState,
    policy,
  );

  /*
   * SECURITY BOUNDARY
   *
   * If verification fails, execution NEVER happens.
   */
  if (!verification.allowed) {
    return reply.code(403).send({
      executed: false,
      verified: false,

      trustedState,

      proposedState,

      violations: verification.violations,
    });
  }

  /*
   * Only verified actions reach the executor.
   */
  try {
    const { action, environment, amount } = result.data;

    const executionResult = await executeTool(
      {
        action,
        ...(environment === undefined ? {} : { environment }),
        ...(amount === undefined ? {} : { amount }),
      },
    );

    return {
      executed: true,
      verified: true,

      trustedState,

      proposedState,

      result: executionResult,
    };
  } catch (error) {
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

    console.log(
      "ProofGate running at http://127.0.0.1:3000",
    );
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();