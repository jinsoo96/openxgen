import { readFileSync, writeFileSync } from "node:fs";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const definition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "file_edit",
    description: "파일에서 특정 텍스트를 찾아 교체합니다.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "파일 경로" },
        old_text: { type: "string", description: "교체할 기존 텍스트" },
        new_text: { type: "string", description: "새 텍스트" },
      },
      required: ["path", "old_text", "new_text"],
    },
  },
};

export async function execute(args: Record<string, unknown>): Promise<string> {
  const path = args.path as string;
  const oldText = args.old_text as string;
  const newText = args.new_text as string;

  try {
    const content = readFileSync(path, "utf-8");
    if (!content.includes(oldText)) {
      return `Error: 텍스트를 찾을 수 없습니다`;
    }
    const updated = content.replace(oldText, newText);
    writeFileSync(path, updated, "utf-8");
    return `파일 수정 완료: ${path}`;
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
}
