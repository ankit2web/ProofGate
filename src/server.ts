import Fastify from "fastify";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { init } from "z3-solver";
import { compileConstraint } from "./constraint-compiler.js";
import { calculateAfterState } from "./state.js";
import { executeTool } from "./tool-executor.js";

const app = Fastify({
    logger: true,
});

// ----------------------------------------
// Request schema
// ----------------------------------------

const ActionRequest = z.object({
  action: z.string(),

  environment: z
    .enum(["development", "staging", "production"])
    .optional(),

  amount: z
    .number()
    .optional(),

  balance: z
    .number()
    .optional(),
});

type ActionRequest = z.infer<typeof ActionRequest>;

// ----------------------------------------
// Policy schema
// ----------------------------------------

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

type Policy = z.infer<typeof Policy>;

// ----------------------------------------
// Load policy
// ----------------------------------------

async function loadPolicy(): Promise<Policy> {
    const file = await readFile("./policies/database.json", "utf-8");

    return Policy.parse(JSON.parse(file));
}

// ----------------------------------------
// Z3 verification
// ----------------------------------------

async function verifyWithZ3(
    request: Record<string, unknown>,
    policy: Policy,
) {
    const { Context } = await init();

    const Z3 = Context("main");

    const violations: string[] = [];

    for (const rule of policy.rules) {
        if (rule.action !== request.action) {
            continue;
        }

        try {
            const solver = new Z3.Solver();

            const constraint = compileConstraint(
                Z3,
                rule.condition,
                request,
            );

            /*
             * The request provides the actual values.
             *
             * Example:
             *
             * amount = 50000
             *
             * The policy says:
             *
             * amount <= 10000
             */

            for (const [name, value] of Object.entries(request)) {
                if (typeof value === "number") {
                    const variable = Z3.Real.const(name);

                    solver.add(
                        variable.eq(Z3.Real.val(value)),
                    );
                }
            }

            solver.add(constraint);

            const result = await solver.check();

            if (result === "unsat") {
                violations.push(
                    `${rule.name}: ${rule.reason}`,
                );
            }
        } catch (error) {
            violations.push(
                `${rule.name}: Could not verify constraint.`,
            );
        }
    }

    return {
        allowed: violations.length === 0,
        violations,
    };
}

// ----------------------------------------
// Verification endpoint
// ----------------------------------------

app.post("/verify", async (request, reply) => {
    const result = ActionRequest.safeParse(request.body);

    if (!result.success) {
        return reply.status(400).send({
            allowed: false,
            error: "Invalid request",
            details: result.error.issues,
        });
    }

    const policy = await loadPolicy();

    const afterState = calculateAfterState(result.data);

    const verification = await verifyWithZ3(
        afterState,
        policy,
    );

    return reply.send({
        request: result.data,
        policy: policy.name,
        ...verification,
    });
});

app.post("/execute", async (request, reply) => {
  const result = ActionRequest.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      executed: false,
      error: "Invalid request",
      details: result.error.issues,
    });
  }

  // ------------------------------------
  // Get current state
  // ------------------------------------

  const currentBalance =
    typeof result.data.balance === "number"
      ? result.data.balance
      : undefined;

  if (currentBalance === undefined) {
    return reply.status(400).send({
      executed: false,
      error: "Current balance is required.",
    });
  }

  // ------------------------------------
  // Calculate proposed state
  // ------------------------------------

  const afterState = calculateAfterState(
    result.data,
  );

  // ------------------------------------
  // Load policy
  // ------------------------------------

  const policy = await loadPolicy();

  // ------------------------------------
  // VERIFY BEFORE EXECUTION
  // ------------------------------------

  const verification = await verifyWithZ3(
    afterState,
    policy,
  );

  if (!verification.allowed) {
    return reply.status(403).send({
      executed: false,
      verified: false,
      violations: verification.violations,
    });
  }

  // ------------------------------------
  // EXECUTE ONLY AFTER VERIFICATION
  // ------------------------------------

  try {
    const executionRequest = {
      action: result.data.action,
      ...(result.data.environment !== undefined && {
        environment: result.data.environment,
      }),
      ...(result.data.amount !== undefined && {
        amount: result.data.amount,
      }),
      ...(result.data.balance !== undefined && {
        balance: result.data.balance,
      }),
    };

    const executionResult =
      await executeTool(executionRequest);

    return reply.send({
      executed: true,
      verified: true,
      result: executionResult,
    });
  } catch (error) {
    return reply.status(500).send({
      executed: false,
      verified: true,
      error:
        error instanceof Error
          ? error.message
          : "Tool execution failed.",
    });
  }
});

// ----------------------------------------
// Start server
// ----------------------------------------

const start = async () => {
    try {
        await app.listen({
            port: 3000,
            host: "127.0.0.1",
        });

        console.log(
            "🛡️ ProofGate running at http://127.0.0.1:3000",
        );
    } catch (error) {
        app.log.error(error);
        process.exit(1);
    }
};

start();