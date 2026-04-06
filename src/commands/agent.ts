/**
 * xgen agent — OPEN XGEN AI 코딩 에이전트
 */
import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline";
import { getDefaultProvider } from "../config/store.js";
import { createLLMClient, streamChat, type Message } from "../agent/llm.js";
import { getAllToolDefs, executeTool, getToolNames } from "../agent/tools/index.js";
import { McpManager, loadMcpConfig } from "../mcp/client.js";
import { printError } from "../utils/format.js";
import { guidedProviderSetup } from "./provider.js";
import { box, divider, statusDot } from "../utils/ui.js";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

const SYSTEM_PROMPT = `You are OPEN XGEN Agent, an AI coding assistant running in the user's terminal.
You have access to tools for reading/writing files, executing commands, searching code, and running sandboxed code.
You can also use MCP (Model Context Protocol) tools if available.
Always respond in the same language as the user.
When using tools, be concise about what you're doing.
For file edits, show what you changed briefly.
For sandbox_run, you can install npm/pip packages and run isolated code.`;

let mcpManager: McpManager | null = null;

export async function agentRepl(): Promise<void> {
  let provider = getDefaultProvider();
  if (!provider) {
    // 프로바이더 없으면 자동 가이드 설정
    provider = await guidedProviderSetup();
    if (!provider) {
      process.exit(1);
    }
  }

  const client = createLLMClient(provider);

  // 기본 도구
  const builtinTools = getAllToolDefs();
  const allTools: ChatCompletionTool[] = [...builtinTools];
  const allToolNames = [...getToolNames()];

  // MCP 로드
  const mcpConfig = loadMcpConfig();
  if (mcpConfig && Object.keys(mcpConfig.mcpServers).length > 0) {
    mcpManager = new McpManager();
    try {
      await mcpManager.startAll(mcpConfig);
      if (mcpManager.serverCount > 0) {
        const mcpTools = mcpManager.getAllTools();
        allTools.push(...mcpTools);
        allToolNames.push(...mcpTools.map((t) => t.function.name));
      }
    } catch {
      // MCP 실패해도 계속 진행
    }
  }

  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

  // 헤더
  console.log();
  console.log(box([
    `${chalk.bold("OPEN XGEN Agent")}`,
    ``,
    `${chalk.gray("프로바이더")}  ${provider.name} ${chalk.gray("·")} ${provider.model}`,
    `${chalk.gray("도구")}      ${getToolNames().length}개 내장${mcpManager && mcpManager.serverCount > 0 ? ` + ${mcpManager.getAllTools().length}개 MCP` : ""}`,
    ``,
    `${chalk.gray("무엇이든 물어보세요. 파일 읽기/쓰기, 코드 실행, 검색 가능.")}`,
    `${chalk.gray("/help 도움말 · /home 홈 · /exit 종료")}`,
  ]));
  console.log();

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const askUser = (): Promise<string> =>
    new Promise((resolve) => rl.question(chalk.cyan.bold("  ❯ "), (a) => resolve(a.trim())));

  // Ctrl+C 처리
  process.on("SIGINT", () => {
    console.log(chalk.gray("\n종료합니다."));
    mcpManager?.stopAll();
    rl.close();
    process.exit(0);
  });

  while (true) {
    const input = await askUser();
    if (!input) continue;

    // 슬래시 커맨드
    if (input === "exit" || input === "/exit") {
      console.log(chalk.gray("종료합니다."));
      mcpManager?.stopAll();
      rl.close();
      break;
    }
    if (input === "/help") {
      console.log();
      console.log(chalk.bold("  슬래시 커맨드"));
      console.log(chalk.gray("  ─────────────────────────────"));
      console.log(`  ${chalk.cyan("/tools")}     사용 가능한 도구 목록`);
      console.log(`  ${chalk.cyan("/provider")}  현재 프로바이더 정보`);
      console.log(`  ${chalk.cyan("/model")}     등록된 프로바이더 목록`);
      console.log(`  ${chalk.cyan("/mcp")}       MCP 서버 상태`);
      console.log(`  ${chalk.cyan("/clear")}     대화 초기화`);
      console.log(`  ${chalk.cyan("/home")}      홈 메뉴로 돌아가기`);
      console.log(`  ${chalk.cyan("/exit")}      종료`);
      console.log();
      continue;
    }
    if (input === "/clear") {
      messages.length = 1;
      console.log(chalk.gray("  대화 초기화됨.\n"));
      continue;
    }
    if (input === "/tools") {
      console.log(chalk.bold("\n내장 도구:"), getToolNames().join(", "));
      if (mcpManager && mcpManager.serverCount > 0) {
        console.log(chalk.bold("MCP 도구:"), mcpManager.getAllTools().map((t) => t.function.name).join(", "));
      }
      console.log();
      continue;
    }
    if (input === "/provider") {
      console.log(chalk.gray(`현재: ${provider.name} (${provider.model})`));
      console.log(chalk.gray(`변경: xgen provider add / xgen provider use <id>\n`));
      continue;
    }
    if (input === "/model") {
      const { getProviders: gp } = await import("../config/store.js");
      const all = gp();
      if (all.length > 0) {
        console.log(chalk.bold("\n  등록된 프로바이더:\n"));
        all.forEach((p, i) => {
          const mark = p.id === provider.id ? chalk.green("● ") : "  ";
          console.log(`    ${mark}${i + 1}) ${p.name} (${p.model})`);
        });
        console.log(chalk.gray("\n  변경하려면 exit 후 xgen provider use <id>\n"));
      }
      continue;
    }
    if (input === "/home" || input === "/menu") {
      console.log(chalk.gray("에이전트를 종료하고 홈으로 돌아갑니다."));
      mcpManager?.stopAll();
      rl.close();
      const { homeMenu } = await import("./home.js");
      await homeMenu();
      return;
    }
    if (input === "/mcp") {
      if (mcpManager && mcpManager.serverCount > 0) {
        console.log(chalk.bold("\nMCP 서버:"), mcpManager.getServerNames().join(", "));
        console.log(chalk.gray("도구:"), mcpManager.getAllTools().map((t) => t.function.name).join(", "));
      } else {
        console.log(chalk.gray("MCP 서버 없음. .mcp.json을 프로젝트 루트에 추가하세요."));
      }
      console.log();
      continue;
    }

    messages.push({ role: "user", content: input });

    try {
      await runAgentLoop(client, provider.model, messages, allTools);
    } catch (err) {
      console.log(chalk.red(`\n오류: ${(err as Error).message}\n`));
    }
  }
}

async function runAgentLoop(
  client: ReturnType<typeof createLLMClient>,
  model: string,
  messages: Message[],
  tools: ChatCompletionTool[]
): Promise<void> {
  const MAX_ITERATIONS = 20;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // AI 응답 시작
    let first = true;
    const result = await streamChat(client, model, messages, tools, (delta) => {
      if (first) {
        process.stdout.write(chalk.green("\n  AI ›") + " ");
        first = false;
      }
      process.stdout.write(delta);
    });

    if (result.content) {
      process.stdout.write("\n\n");
    }

    if (result.toolCalls.length === 0) {
      if (result.content) {
        messages.push({ role: "assistant", content: result.content });
      }
      return;
    }

    // assistant 메시지 추가
    messages.push({
      role: "assistant",
      content: result.content || null,
      tool_calls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    });

    // 도구 실행
    for (const tc of result.toolCalls) {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.arguments);
      } catch {
        args = {};
      }

      console.log(chalk.gray(`  ⚙ `) + chalk.white.bold(tc.name) + chalk.gray(` ${summarizeArgs(args)}`));

      let toolResult: string;
      if (mcpManager?.isMcpTool(tc.name)) {
        toolResult = await mcpManager.callTool(tc.name, args);
      } else {
        toolResult = await executeTool(tc.name, args);
      }

      const truncated =
        toolResult.length > 4000 ? toolResult.slice(0, 4000) + "\n...(truncated)" : toolResult;

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: truncated,
      });
    }
  }

  console.log(chalk.yellow("\n최대 반복 횟수에 도달했습니다.\n"));
}

function summarizeArgs(args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    const s = String(v);
    parts.push(`${k}: ${s.length > 40 ? s.slice(0, 40) + "..." : s}`);
  }
  return parts.join(", ");
}

export function registerAgentCommand(program: Command): void {
  program
    .command("agent")
    .description("OPEN XGEN AI 코딩 에이전트")
    .action(async () => {
      await agentRepl();
    });
}
