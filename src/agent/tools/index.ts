/**
 * Agent 도구 레지스트리
 */
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import * as fileRead from "./file-read.js";
import * as fileWrite from "./file-write.js";
import * as fileEdit from "./file-edit.js";
import * as bash from "./bash.js";
import * as grep from "./grep.js";
import * as listFiles from "./list-files.js";
import * as sandbox from "./sandbox.js";

interface Tool {
  definition: ChatCompletionTool;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

const tools: Tool[] = [fileRead, fileWrite, fileEdit, bash, grep, listFiles, sandbox];

const toolMap = new Map<string, Tool>();
for (const t of tools) {
  toolMap.set(t.definition.function.name, t);
}

export function getAllToolDefs(): ChatCompletionTool[] {
  return tools.map((t) => t.definition);
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const tool = toolMap.get(name);
  if (!tool) return `Unknown tool: ${name}`;
  return tool.execute(args);
}

export function getToolNames(): string[] {
  return tools.map((t) => t.definition.function.name);
}
