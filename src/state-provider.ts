import { toolRegistry } from "./tool-registry-instance.js";

export async function getTrustedState(request: Record<string, unknown>) {
  const tool = toolRegistry.getTool(String(request.action));

  return tool.getTrustedState(
    request as Parameters<typeof tool.getTrustedState>[0],
  );
}
