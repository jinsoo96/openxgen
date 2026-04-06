/**
 * Sandbox — 격리된 환경에서 코드 실행
 * npm (Node.js) / python 지원
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

const SANDBOX_DIR = join(tmpdir(), "xgen-sandbox");

function ensureSandbox(): string {
  if (!existsSync(SANDBOX_DIR)) {
    mkdirSync(SANDBOX_DIR, { recursive: true });
  }
  return SANDBOX_DIR;
}

export const definition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "sandbox_run",
    description:
      "격리된 샌드박스에서 코드를 실행합니다. Node.js 또는 Python 코드를 안전하게 실행할 수 있습니다. npm 패키지 설치도 가능합니다.",
    parameters: {
      type: "object",
      properties: {
        language: {
          type: "string",
          enum: ["javascript", "typescript", "python"],
          description: "실행할 언어",
        },
        code: { type: "string", description: "실행할 코드" },
        packages: {
          type: "array",
          items: { type: "string" },
          description: "설치할 패키지 (npm 또는 pip)",
        },
      },
      required: ["language", "code"],
    },
  },
};

export async function execute(args: Record<string, unknown>): Promise<string> {
  const language = args.language as string;
  const code = args.code as string;
  const packages = (args.packages as string[]) ?? [];

  const dir = ensureSandbox();
  const runId = `run_${Date.now()}`;
  const runDir = join(dir, runId);
  mkdirSync(runDir, { recursive: true });

  try {
    // 패키지 설치
    if (packages.length > 0) {
      if (language === "python") {
        const pkgList = packages.join(" ");
        execSync(`pip install ${pkgList}`, {
          cwd: runDir,
          encoding: "utf-8",
          timeout: 60_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } else {
        // Node.js — npm init + install
        execSync("npm init -y", { cwd: runDir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
        const pkgList = packages.join(" ");
        execSync(`npm install ${pkgList}`, {
          cwd: runDir,
          encoding: "utf-8",
          timeout: 60_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
      }
    }

    // 코드 실행
    let cmd: string;
    let filename: string;

    if (language === "python") {
      filename = "script.py";
      writeFileSync(join(runDir, filename), code, "utf-8");
      cmd = `python3 ${filename}`;
    } else if (language === "typescript") {
      filename = "script.ts";
      writeFileSync(join(runDir, filename), code, "utf-8");
      cmd = `npx tsx ${filename}`;
    } else {
      filename = "script.mjs";
      writeFileSync(join(runDir, filename), code, "utf-8");
      cmd = `node ${filename}`;
    }

    const output = execSync(cmd, {
      cwd: runDir,
      encoding: "utf-8",
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });

    return output || "(no output)";
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    return (e.stdout || "") + (e.stderr || "") || `Error: ${e.message}`;
  } finally {
    // 정리
    try {
      rmSync(runDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
