import { execSync } from "node:child_process";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const definition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "grep",
    description: "파일에서 패턴을 검색합니다 (재귀, 줄 번호 포함).",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "검색 패턴 (정규식)" },
        path: { type: "string", description: "검색 디렉토리 또는 파일 (기본: .)" },
        glob: { type: "string", description: "파일 필터 (예: *.ts)" },
      },
      required: ["pattern"],
    },
  },
};

export async function execute(args: Record<string, unknown>): Promise<string> {
  const pattern = args.pattern as string;
  const path = (args.path as string) || ".";
  const glob = args.glob as string | undefined;

  try {
    let cmd = `grep -rn --color=never "${pattern.replace(/"/g, '\\"')}" "${path}"`;
    if (glob) cmd += ` --include="${glob}"`;
    cmd += " | head -50";

    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 10_000,
      maxBuffer: 512 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output || "일치하는 결과 없음";
  } catch {
    return "일치하는 결과 없음";
  }
}
