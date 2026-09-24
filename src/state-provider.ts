import { getTool } from "./tool-registry.js";

export async function getTrustedState(
  request: Record<string, unknown>,
) {
  const tool = getTool(
    String(request.action),
  );

  return tool.getTrustedState(
    request as Parameters<typeof tool.getTrustedState>[0],
  );
}