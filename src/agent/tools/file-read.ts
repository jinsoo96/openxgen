import { readFileSync } from "node:fs";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const definition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "file_read",
    description: "파일 내용을 읽습니다. 줄 번호가 포함됩니다.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "파일 경로" },
        start_line: { type: "number", description: "시작 줄 번호 (선택)" },
        end_line: { type: "number", description: "끝 줄 번호 (선택)" },
      },
      required: ["path"],
    },
  },
};

export async function execute(args: Record<string, unknown>): Promise<string> {
  const path = args.path as string;
  const startLine = (args.start_line as number) || 1;
  const endLine = args.end_line as number | undefined;

  try {
    const content = readFileSync(path, "utf-8");
    const lines = content.split("\n");
    const sliced = lines.slice(startLine - 1, endLine ?? lines.length);
    return sliced.map((line, i) => `${startLine + i}\t${line}`).join("\n");
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
}
