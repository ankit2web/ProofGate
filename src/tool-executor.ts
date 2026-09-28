import { getTool, type ToolRequest } from "./tool-registry.js";

export async function executeTool(
  request: ToolRequest,
  trustedState: Record<string, unknown>,
) {
  const tool = getTool(request.action);

  const validatedRequest = tool.validateRequest(request);

  return tool.execute(validatedRequest, trustedState);
}
