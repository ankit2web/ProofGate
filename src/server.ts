import Fastify from "fastify";
import { z } from "zod";
import { calculateAfterState } from "./state.js";
import { executeTool } from "./tool-executor.js";
import { getTrustedState } from "./state-provider.js";
import { verifyPolicy } from "./policy-engine.js";
import { loadPolicy } from "./policy-loader.js";

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
  const verification = await verifyPolicy(
    policy,
    result.data,
    proposedState,
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
  const verification = await verifyPolicy(
    policy,
    result.data,
    proposedState,
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