import { execSync } from "node:child_process";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const definition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "list_files",
    description: "디렉토리의 파일/폴더 목록을 반환합니다. glob 패턴 지원.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "디렉토리 경로 (기본: .)" },
        pattern: { type: "string", description: "glob 패턴 (예: **/*.ts)" },
      },
    },
  },
};

export async function execute(args: Record<string, unknown>): Promise<string> {
  const path = (args.path as string) || ".";
  const pattern = args.pattern as string | undefined;

  try {
    let cmd: string;
    if (pattern) {
      cmd = `find "${path}" -name "${pattern}" -type f | head -100`;
    } else {
      cmd = `ls -la "${path}"`;
    }
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output || "(empty)";
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
}
