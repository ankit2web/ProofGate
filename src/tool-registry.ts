import type { ToolDefinition } from "./tool-definition.js";

export type ToolRegistry = {
  getTool: (name: string) => ToolDefinition;
  getTools: () => ToolDefinition[];
};

export function createToolRegistry(
  definitions: ToolDefinition[],
): ToolRegistry {
  const tools = new Map<string, ToolDefinition>();

  for (const tool of definitions) {
    if (tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }

    tools.set(tool.name, tool);
  }

  return {
    getTool(name: string): ToolDefinition {
      const tool = tools.get(name);

      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      return tool;
    },

    getTools(): ToolDefinition[] {
      return Array.from(tools.values());
    },
  };
}
