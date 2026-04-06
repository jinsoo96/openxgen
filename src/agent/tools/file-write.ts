import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const definition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "file_write",
    description: "파일을 생성하거나 덮어씁니다.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "파일 경로" },
        content: { type: "string", description: "파일 내용" },
      },
      required: ["path", "content"],
    },
  },
};

export async function execute(args: Record<string, unknown>): Promise<string> {
  const path = args.path as string;
  const content = args.content as string;

  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf-8");
    return `파일 작성 완료: ${path}`;
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
}
