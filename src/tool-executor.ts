import { toolRegistry } from "./tool-registry-instance.js";
import type { ToolRequest } from "./tool-definition.js";

export async function executeTool(
  request: ToolRequest,
  trustedState: Record<string, unknown>,
) {
  const tool = toolRegistry.getTool(request.action);

  const validatedRequest = tool.validateRequest(request);

  return tool.execute(validatedRequest, trustedState);
}
