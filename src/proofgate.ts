import { hashPolicy } from "./policy-hash.js";
import { verifyPolicy } from "./policy-engine.js";
import { getTrustedState } from "./state-provider.js";
import { calculateAfterState } from "./state.js";
import { executeTool } from "./tool-executor.js";
import { toolRegistry } from "./tool-registry-instance.js";
import type { ToolRequest } from "./tool-definition.js";
import { writeAuditLog } from "./audit-logger.js";
import {
  hashRequest,
  storeExecution,
  getExecution,
  getInFlightExecution,
  claimInFlightExecution,
} from "./idempotency-store.js";
import { loadPolicyForAction } from "./policy-loader.js";

export type ProofGateRequest = Record<string, unknown>;

export type ExecutionOptions = {
  idempotencyKey?: string;
};

export type ProofGateResult = {
  traceId: string;

  request: Record<string, unknown>;

  trustedState: Record<string, unknown>;

  proposedState: Record<string, unknown>;

  policy: {
    name: string;
    version: string;
    hash: string;
  };

  verification: {
    allowed: boolean;
    violations: {
      rule: string;
      reason: string;
    }[];
  };

  executed: boolean;
  replayed: boolean;

  executionResult?: unknown;

  executionError?: string;
};

export async function verify(
  request: ProofGateRequest,
  traceId: string,
): Promise<ProofGateResult> {
  const tool = toolRegistry.getTool(String(request.action));

  const validatedRequest = tool.validateRequest(request);

  const trustedState = await getTrustedState(validatedRequest);

  const proposedState = calculateAfterState(validatedRequest, trustedState);

  const policy = await loadPolicyForAction(validatedRequest.action);

  const policyHash = hashPolicy(policy);

  const verification = await verifyPolicy(
    policy,
    validatedRequest,
    proposedState,
  );

  await writeAuditLog({
    traceId,

    request: validatedRequest,

    trustedState,

    proposedState,

    policy: policy.name,

    policyVersion: policy.version,

    policyHash,

    decision: verification.allowed ? "ALLOW" : "BLOCK",

    violations: verification.violations,

    executed: false,

    replayed: false,
  });

  return {
    traceId,

    request: validatedRequest,

    trustedState,

    proposedState,

    policy: {
      name: policy.name,
      version: policy.version,
      hash: policyHash,
    },

    verification,

    executed: false,

    replayed: false,
  };
}

/**
 * Performs the actual ProofGate verification + execution flow.
 *
 * Idempotency coordination is intentionally handled by the
 * public execute() wrapper below.
 */
async function executeInternal(
  request: ProofGateRequest,
  traceId: string,
  idempotencyKey?: string,
): Promise<ProofGateResult> {
  const tool = toolRegistry.getTool(String(request.action));

  const validatedRequest = tool.validateRequest(request);

  const trustedState = await getTrustedState(validatedRequest);

  const proposedState = calculateAfterState(validatedRequest, trustedState);

  const policy = await loadPolicyForAction(validatedRequest.action);

  const policyHash = hashPolicy(policy);

  const verification = await verifyPolicy(
    policy,
    validatedRequest,
    proposedState,
  );

  /*
   * Policy blocked the request.
   *
   * No external tool execution happens.
   */
  if (!verification.allowed) {
    await writeAuditLog({
      traceId,

      request: validatedRequest,

      trustedState,

      proposedState,

      policy: policy.name,

      policyVersion: policy.version,

      policyHash,

      decision: "BLOCK",

      violations: verification.violations,

      executed: false,

      replayed: false,
    });

    return {
      traceId,

      request: validatedRequest,

      trustedState,

      proposedState,

      policy: {
        name: policy.name,
        version: policy.version,
        hash: policyHash,
      },

      verification,

      executed: false,

      replayed: false,
    };
  }

  /*
   * Policy allowed the request.
   *
   * Only now can the real tool/external service execute.
   */
  try {
    const executionResult = idempotencyKey
      ? await executeTool(validatedRequest as ToolRequest, trustedState, {
          idempotencyKey,
        })
      : await executeTool(validatedRequest as ToolRequest, trustedState);

    const result: ProofGateResult = {
      traceId,

      request: validatedRequest,

      trustedState,

      proposedState,

      policy: {
        name: policy.name,
        version: policy.version,
        hash: policyHash,
      },

      verification,

      executed: true,

      replayed: false,

      executionResult,
    };

    await writeAuditLog({
      traceId,

      request: validatedRequest,

      trustedState,

      proposedState,

      policy: policy.name,

      policyVersion: policy.version,

      policyHash,

      decision: "ALLOW",

      violations: [],

      executed: true,

      replayed: false,

      executionResult,
    });

    return result;
  } catch (error) {
    const executionError =
      error instanceof Error ? error.message : String(error);

    await writeAuditLog({
      traceId,

      request: validatedRequest,

      trustedState,

      proposedState,

      policy: policy.name,

      policyVersion: policy.version,

      policyHash,

      decision: "ALLOW",

      violations: [],

      executed: false,

      replayed: false,

      executionError,
    });

    return {
      traceId,

      request: validatedRequest,

      trustedState,

      proposedState,

      policy: {
        name: policy.name,

        version: policy.version,

        hash: policyHash,
      },

      verification,

      executed: false,

      replayed: false,

      executionError,
    };
  }
}

/**
 * Executes a ProofGate request with optional idempotency.
 *
 * Requests without an idempotency key execute normally.
 *
 * Requests with an idempotency key are protected against:
 *
 * 1. Sequential duplicate execution.
 * 2. Concurrent duplicate execution.
 * 3. Reusing a key for a different request.
 */
export async function execute(
  request: ProofGateRequest,
  traceId: string,
  options: ExecutionOptions = {},
): Promise<ProofGateResult> {
  const idempotencyKey = options.idempotencyKey;

  /*
   * No idempotency requested.
   */
  if (!idempotencyKey) {
    return executeInternal(request, traceId);
  }

  /*
   * Validate before calculating the request hash.
   *
   * This ensures the hash represents the canonical,
   * validated request rather than arbitrary caller input.
   */
  const tool = toolRegistry.getTool(String(request.action));

  const validatedRequest = tool.validateRequest(request);

  const requestHash = hashRequest(validatedRequest);

  /*
   * ---------------------------------------------------------
   * 1. Check completed executions.
   * ---------------------------------------------------------
   */
  const existingExecution = getExecution(idempotencyKey);

  if (existingExecution) {
    if (existingExecution.requestHash !== requestHash) {
      throw new Error(
        "Idempotency key has already been used for a different request.",
      );
    }

    const previousResult = existingExecution.result as ProofGateResult;

    return {
      ...previousResult,

      traceId,

      replayed: true,
    };
  }

  /*
   * ---------------------------------------------------------
   * 2. Check an execution that is already in progress.
   * ---------------------------------------------------------
   */
  const existingInFlight = getInFlightExecution(idempotencyKey);

  if (existingInFlight) {
    if (existingInFlight.requestHash !== requestHash) {
      throw new Error(
        "Idempotency key has already been used for a different request.",
      );
    }

    const completedExecution = await existingInFlight.promise;

    const previousResult = completedExecution.result as ProofGateResult;

    return {
      ...previousResult,

      traceId,

      replayed: true,
    };
  }

  /*
   * ---------------------------------------------------------
   * 3. Start the real execution.
   * ---------------------------------------------------------
   *
   * The Promise is created immediately.
   *
   * claimInFlightExecution() then registers that Promise
   * synchronously before another caller can claim the same
   * idempotency key.
   */
  const executionPromise = executeInternal(
    validatedRequest,
    traceId,
    idempotencyKey,
  ).then((result) => {
    const storedExecution = {
      requestHash,

      result,
    };

    storeExecution(idempotencyKey, storedExecution);

    return storedExecution;
  });

  /*
   * ---------------------------------------------------------
   * 4. Atomically claim the idempotency key.
   * ---------------------------------------------------------
   */
  const existingClaim = claimInFlightExecution(
    idempotencyKey,
    requestHash,
    executionPromise,
  );

  /*
   * Another request claimed the key first.
   *
   * Wait for that request instead of executing the
   * external side effect again.
   */
  if (existingClaim) {
    if (existingClaim.requestHash !== requestHash) {
      throw new Error(
        "Idempotency key has already been used for a different request.",
      );
    }

    const completedExecution = await existingClaim.promise;

    const previousResult = completedExecution.result as ProofGateResult;

    return {
      ...previousResult,

      traceId,

      replayed: true,
    };
  }

  /*
   * We successfully claimed the key.
   *
   * This request owns the execution.
   */
  const completedExecution = await executionPromise;

  return completedExecution.result as ProofGateResult;
}
