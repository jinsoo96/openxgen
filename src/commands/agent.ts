/**
 * OPEN XGEN — AI 에이전트 (메인 인터페이스)
 * Claude Code / Gemini CLI 스타일 — 채팅이 곧 인터페이스
 */
import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline";
import { getDefaultProvider, getServer, getAuth, getEnvironments, getActiveEnvironment } from "../config/store.js";
import { createLLMClient, streamChat, type Message } from "../agent/llm.js";
import { getAllToolDefs, executeTool, getToolNames } from "../agent/tools/index.js";
import { definitions as xgenToolDefs, execute as xgenExecute, isXgenTool } from "../agent/tools/xgen-api.js";
import { McpManager, loadMcpConfig } from "../mcp/client.js";
import { guidedProviderSetup } from "./provider.js";
import { box, ask, welcome } from "../utils/ui.js";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

function buildSystemPrompt(): string {
  const server = getServer();
  const auth = getAuth();
  const env = getActiveEnvironment();

  let prompt = `You are OPEN XGEN, a terminal AI agent. Act like Claude Code.

ABSOLUTE RULES — VIOLATING THESE IS FAILURE:
1. NEVER show menus, numbered options, or "다음 중 선택" style responses. NEVER.
2. NEVER ask "무엇을 도와드릴까요" or "어떤 작업을 하시겠습니까". NEVER.
3. When the user asks something → call the tool IMMEDIATELY. No preamble.
4. After tool results → show the data directly. One sentence summary max.
5. If user says a number → it refers to the previous list item. Act on it.
6. If user says "실행" → execute immediately with context you have. Don't ask for confirmation.
7. If ambiguous → make your best guess and do it. Don't ask.
8. Response language: match the user. Korean → Korean.
9. Max response: 1-2 sentences + data. No filler, no explanations unless asked.
10. You are NOT a menu system. You are a doer. Do, don't ask.

EXAMPLES OF BAD RESPONSES (NEVER DO THIS):
- "다음과 같은 작업이 가능합니다: 1. 목록 2. 실행..."
- "원하는 작업을 선택해 주세요"
- "어떻게 도와드릴까요?"
- Any numbered list of options

EXAMPLES OF GOOD RESPONSES:
- User: "워크플로우" → [call xgen_workflow_list] → show list
- User: "6" → [call xgen_workflow_run for item 6] → show result
- User: "컬렉션" → [call xgen_collection_list] → show list
- User: "이 폴더 뭐있어" → [call list_files] → show files`;

  if (server && auth) {
    prompt += `

XGEN CONNECTED: ${server} as ${auth.username} (${env?.name ?? "default"})
- Workflow execute uses deploy_key for deployed workflows.
- If workflow execution returns 404, it means the Istio routing blocks direct stream access. Use deploy endpoint.`;
  } else {
    prompt += `\nXGEN: Not connected. Tell user to run /connect.`;
  }

  return prompt;
}

let mcpManager: McpManager | null = null;

export async function agentRepl(): Promise<void> {
  // 프로바이더 확인/설정
  let provider = getDefaultProvider();
  if (!provider) {
    provider = await guidedProviderSetup();
    if (!provider) process.exit(1);
  }

  const client = createLLMClient(provider);

  // 도구 조합: 기본 + XGEN + MCP
  const allTools: ChatCompletionTool[] = [...getAllToolDefs(), ...xgenToolDefs];
  const builtinNames = getToolNames();

  // MCP
  const mcpConfig = loadMcpConfig();
  if (mcpConfig && Object.keys(mcpConfig.mcpServers).length > 0) {
    mcpManager = new McpManager();
    try {
      await mcpManager.startAll(mcpConfig);
      if (mcpManager.serverCount > 0) allTools.push(...mcpManager.getAllTools());
    } catch { /* MCP 실패해도 계속 */ }
  }

  const messages: Message[] = [{ role: "system", content: buildSystemPrompt() }];

  // ── 헤더 ──
  const server = getServer();
  const auth = getAuth();
  const env = getActiveEnvironment();

  const W = Math.min(process.stdout.columns || 60, 60);
  const line = chalk.cyan("─".repeat(W));

  console.log(`\n${line}`);
  console.log(chalk.cyan.bold("  ✦ OPEN XGEN"));
  console.log(line);
  console.log();
  console.log(chalk.gray(`  model  ${provider.model}`));
  if (server && auth) {
    console.log(chalk.gray(`  xgen   ${chalk.green("●")} ${auth.username}@${(env?.name ?? server).replace("https://", "")}`));
  }
  console.log(chalk.gray(`  cwd    ${process.cwd()}`));
  console.log();
  console.log(chalk.gray(`  무엇이든 물어보세요. /help`));
  console.log();

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const askUser = (): Promise<string> =>
    new Promise((resolve) => rl.question(chalk.cyan("  ❯ "), (a) => resolve(a.trim())));

  process.on("SIGINT", () => {
    console.log(chalk.gray("\n  👋\n"));
    mcpManager?.stopAll();
    rl.close();
    process.exit(0);
  });

  while (true) {
    const input = await askUser();
    if (!input) continue;

    // ── 슬래시 커맨드 ──
    if (input === "/exit" || input === "exit") {
      console.log(chalk.gray("\n  👋\n"));
      mcpManager?.stopAll();
      rl.close();
      break;
    }

    if (input === "/help") {
      console.log(`
  ${chalk.bold("슬래시 커맨드")}
  ${chalk.cyan("/connect")}    XGEN 서버 연결 + 로그인
  ${chalk.cyan("/env")}        환경 전환 (본사/제주/롯데몰)
  ${chalk.cyan("/provider")}  프로바이더 변경
  ${chalk.cyan("/dashboard")} TUI 대시보드 (4분할 화면)
  ${chalk.cyan("/tools")}     사용 가능한 도구 목록
  ${chalk.cyan("/status")}    현재 연결 상태
  ${chalk.cyan("/clear")}     대화 초기화
  ${chalk.cyan("/exit")}      종료
`);
      continue;
    }

    if (input === "/clear") {
      messages.length = 0;
      messages.push({ role: "system", content: buildSystemPrompt() });
      console.log(chalk.gray("  대화 초기화됨.\n"));
      continue;
    }

    if (input === "/status") {
      const p = getDefaultProvider();
      const s = getServer();
      const a = getAuth();
      const e = getActiveEnvironment();
      console.log();
      console.log(`  ${chalk.bold("프로바이더")} ${p ? `${p.name} · ${p.model}` : chalk.red("미설정")}`);
      console.log(`  ${chalk.bold("서버")}      ${s && a ? `${a.username}@${s.replace("https://", "")}` : chalk.red("미연결")}`);
      console.log(`  ${chalk.bold("환경")}      ${e?.name ?? "없음"} (${getEnvironments().length}개 등록)`);
      if (mcpManager?.serverCount) {
        console.log(`  ${chalk.bold("MCP")}       ${mcpManager.getServerNames().join(", ")}`);
      }
      console.log();
      continue;
    }

    if (input === "/tools") {
      console.log(`\n  ${chalk.bold("코딩")}  ${builtinNames.join(", ")}`);
      console.log(`  ${chalk.bold("XGEN")}  ${xgenToolDefs.map((t) => t.function.name).join(", ")}`);
      if (mcpManager?.serverCount) {
        console.log(`  ${chalk.bold("MCP")}   ${mcpManager.getAllTools().map((t) => t.function.name).join(", ")}`);
      }
      console.log();
      continue;
    }

    if (input === "/connect") {
      await connectServer();
      // 시스템 프롬프트 갱신
      messages[0] = { role: "system", content: buildSystemPrompt() };
      continue;
    }

    if (input === "/env") {
      await switchEnv();
      messages[0] = { role: "system", content: buildSystemPrompt() };
      continue;
    }

    if (input === "/provider") {
      const { guidedProviderSetup: setup } = await import("./provider.js");
      await setup();
      console.log(chalk.gray("  프로바이더 변경됨. /exit 후 재시작하세요.\n"));
      continue;
    }

    if (input === "/dashboard" || input === "/dash") {
      console.log(chalk.gray("  대시보드 열기...\n"));
      mcpManager?.stopAll();
      rl.close();
      if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
      const { startTui } = await import("../dashboard/tui.js");
      await startTui();
      return; // TUI 종료 후 CLI도 종료
    }

    // ── AI 대화 ──
    messages.push({ role: "user", content: input });

    try {
      await runLoop(client, provider.model, messages, allTools);
    } catch (err) {
      console.log(chalk.red(`\n  오류: ${(err as Error).message}\n`));
    }
  }
}

async function runLoop(
  client: ReturnType<typeof createLLMClient>,
  model: string,
  messages: Message[],
  tools: ChatCompletionTool[]
): Promise<void> {
  for (let i = 0; i < 20; i++) {
    let first = true;
    const result = await streamChat(client, model, messages, tools, (delta) => {
      if (first) { process.stdout.write(chalk.green("\n  ") + ""); first = false; }
      process.stdout.write(delta);
    });

    if (result.content) process.stdout.write("\n\n");

    if (result.toolCalls.length === 0) {
      if (result.content) messages.push({ role: "assistant", content: result.content });
      return;
    }

    messages.push({
      role: "assistant",
      content: result.content || null,
      tool_calls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    });

    for (const tc of result.toolCalls) {
      let args: Record<string, unknown>;
      try { args = JSON.parse(tc.arguments); } catch { args = {}; }

      const shortArgs = Object.entries(args).map(([k, v]) => {
        const s = String(v);
        return `${k}=${s.length > 30 ? s.slice(0, 30) + "…" : s}`;
      }).join(" ");
      console.log(chalk.gray(`  ⚙ ${chalk.white(tc.name)} ${shortArgs}`));

      let toolResult: string;
      if (isXgenTool(tc.name)) {
        toolResult = await xgenExecute(tc.name, args);
      } else if (mcpManager?.isMcpTool(tc.name)) {
        toolResult = await mcpManager.callTool(tc.name, args);
      } else {
        toolResult = await executeTool(tc.name, args);
      }

      const truncated = toolResult.length > 4000 ? toolResult.slice(0, 4000) + "\n…(truncated)" : toolResult;
      messages.push({ role: "tool", tool_call_id: tc.id, content: truncated });
    }
  }
  console.log(chalk.yellow("\n  최대 반복 횟수 도달.\n"));
}

async function connectServer(): Promise<void> {
  const { setServer, setAuth } = await import("../config/store.js");
  const { addEnvironment } = await import("../config/store.js");

  console.log(chalk.bold("\n  XGEN 서버 연결\n"));

  const presets = [
    { id: "hq", name: "본사", url: "https://xgen.x2bee.com", email: "admin@plateer.com" },
    { id: "jeju", name: "제주", url: "https://jeju-xgen.x2bee.com", email: "admin@plateer.com" },
    { id: "lotte", name: "롯데몰", url: "https://lotteimall-xgen.x2bee.com" },
  ];
  presets.forEach((p, i) => console.log(`  ${chalk.cyan(`${i + 1}.`)} ${p.name} ${chalk.gray(p.url)}`));
  console.log(`  ${chalk.cyan("4.")} 직접 입력`);
  console.log();

  const choice = await ask(chalk.cyan("  ❯ "));
  let url: string;
  let email: string | undefined;
  const ci = parseInt(choice) - 1;
  if (ci >= 0 && ci < presets.length) {
    url = presets[ci].url;
    email = presets[ci].email;
    addEnvironment({ ...presets[ci], description: presets[ci].name });
  } else {
    url = await ask(chalk.white("  URL: "));
    if (!url) return;
  }

  setServer(url);
  console.log(chalk.green(`  ✓ ${url}\n`));

  const inputEmail = email || await ask(chalk.white("  이메일: "));
  const pw = await ask(chalk.white("  비밀번호: "));
  if (!inputEmail || !pw) return;

  try {
    const { apiLogin } = await import("../api/auth.js");
    const result = await apiLogin(inputEmail, pw);
    if (result.success && result.access_token) {
      setAuth({ accessToken: result.access_token, refreshToken: result.refresh_token ?? "", userId: result.user_id ?? "", username: result.username ?? "", isAdmin: false, expiresAt: null });
      console.log(chalk.green(`  ✓ ${result.username} 로그인됨\n`));
    } else {
      console.log(chalk.red(`  ✗ ${result.message}\n`));
    }
  } catch (err) {
    console.log(chalk.red(`  ✗ ${(err as Error).message}\n`));
  }
}

async function switchEnv(): Promise<void> {
  const { getEnvironments: getEnvs, switchEnvironment } = await import("../config/store.js");
  const envs = getEnvs();
  if (!envs.length) {
    console.log(chalk.gray("\n  환경 없음. /connect로 먼저 연결하세요.\n"));
    return;
  }
  const active = getActiveEnvironment();
  console.log();
  envs.forEach((e, i) => {
    const mark = e.id === active?.id ? chalk.green("● ") : "  ";
    console.log(`  ${mark}${chalk.cyan(`${i + 1}.`)} ${e.name} ${chalk.gray(e.url)}`);
  });
  console.log();
  const ci = parseInt(await ask(chalk.cyan("  ❯ "))) - 1;
  if (ci >= 0 && ci < envs.length) {
    switchEnvironment(envs[ci].id);
    console.log(chalk.green(`  ✓ ${envs[ci].name}\n`));
  }
}

export function registerAgentCommand(program: Command): void {
  program
    .command("agent")
    .description("OPEN XGEN AI 에이전트")
    .action(async () => { await agentRepl(); });
}
