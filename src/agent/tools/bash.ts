import { execSync } from "node:child_process";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const definition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "bash",
    description: "셸 명령어를 실행합니다. stdout + stderr를 반환합니다.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "실행할 명령어" },
      },
      required: ["command"],
    },
  },
};

export async function execute(args: Record<string, unknown>): Promise<string> {
  const command = args.command as string;

  try {
    const output = execSync(command, {
      encoding: "utf-8",
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output || "(no output)";
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    return (e.stdout || "") + (e.stderr || "") || `Error: ${e.message}`;
  }
}
