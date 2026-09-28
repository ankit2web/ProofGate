import { hashPolicy } from "./policy-hash.js";
import { loadPolicy } from "./policy-loader.js";
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

export async function execute(
  request: ProofGateRequest,
  traceId: string,
  options: ExecutionOptions = {},
): Promise<ProofGateResult> {
  const tool = toolRegistry.getTool(String(request.action));

  const validatedRequest = tool.validateRequest(request);

  const idempotencyKey = options.idempotencyKey;
  const requestHash = idempotencyKey
    ? hashRequest(validatedRequest)
    : undefined;

  if (idempotencyKey && requestHash) {
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
  }

  const trustedState = await getTrustedState(validatedRequest);

  const proposedState = calculateAfterState(validatedRequest, trustedState);

  const policy = await loadPolicyForAction(validatedRequest.action);

  const policyHash = hashPolicy(policy);

  const verification = await verifyPolicy(
    policy,
    validatedRequest,
    proposedState,
  );

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

  try {
    const executionResult = await executeTool(
      validatedRequest as ToolRequest,
      trustedState,
    );

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

    if (idempotencyKey && requestHash) {
      storeExecution(idempotencyKey, {
        requestHash,
        result,
      });
    }

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
