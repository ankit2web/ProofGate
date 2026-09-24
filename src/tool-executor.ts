import {
  getTool,
  type ToolRequest,
} from "./tool-registry.js";

export async function executeTool(
  request: ToolRequest,
) {
  const tool = getTool(request.action);

  return tool.execute(request);
}