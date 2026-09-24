import { getTool } from "./tool-registry.js";

export function calculateAfterState(
  request: Record<string, unknown>,
  trustedState: Record<string, unknown>,
) {
  const tool = getTool(
    String(request.action),
  );

  return tool.calculateAfterState(
    request as Parameters<typeof tool.calculateAfterState>[0],
    trustedState,
  );
}