import { hashPolicy } from "./policy-hash.js";
import { loadPolicy } from "./policy-loader.js";
import { verifyPolicy } from "./policy-engine.js";
import { getTrustedState } from "./state-provider.js";
import { calculateAfterState } from "./state.js";
import { executeTool } from "./tool-executor.js";
import { getTool, type ToolRequest } from "./tool-registry.js";
import { writeAuditLog } from "./audit-logger.js";

export type ProofGateRequest = Record<string, unknown>;

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

  executionResult?: unknown;

  executionError?: string;
};

export async function verify(
  request: ProofGateRequest,
  traceId: string,
): Promise<ProofGateResult> {
  const tool = getTool(String(request.action));

  const validatedRequest = tool.validateRequest(request);

  const trustedState = await getTrustedState(validatedRequest);

  const proposedState = calculateAfterState(validatedRequest, trustedState);

  const policy = await loadPolicy();

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
  };
}

export async function execute(
  request: ProofGateRequest,
  traceId: string,
): Promise<ProofGateResult> {
  const tool = getTool(String(request.action));

  const validatedRequest = tool.validateRequest(request);

  const trustedState = await getTrustedState(validatedRequest);

  const proposedState = calculateAfterState(validatedRequest, trustedState);

  const policy = await loadPolicy();

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
    };
  }

  try {
    const executionResult = await executeTool(validatedRequest as ToolRequest);

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

      executed: true,

      executionResult,
    };
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

      executionError,
    };
  }
}
