/**
 * OPEN XGEN — AI 에이전트 (메인 인터페이스)
 * Claude Code / Gemini CLI 스타일 — 채팅이 곧 인터페이스
 */
import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getDefaultProvider, getServer, getAuth, getEnvironments, getActiveEnvironment } from "../config/store.js";
import { createLLMClient, streamChat, type Message, type TokenUsage } from "../agent/llm.js";
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

XGEN CONNECTED: ${server} as ${auth.username}

You have full access to XGEN platform. Available tools:

WORKFLOW: xgen_workflow_list, xgen_workflow_run (모든 워크플로우 실행 가능, 배포 무관), xgen_workflow_info, xgen_execution_history, xgen_workflow_performance, xgen_workflow_store, xgen_workflow_generate (자연어로 워크플로우 자동 생성)
DOCUMENTS: xgen_collection_list, xgen_document_list, xgen_document_upload
NODES: xgen_node_list, xgen_node_search, xgen_node_categories
PROMPTS: xgen_prompt_list
TOOLS: xgen_tool_store, xgen_user_tools
SCHEDULE: xgen_schedule_list
TRACE: xgen_trace_list, xgen_interaction_list
MCP: xgen_mcp_sessions
ONTOLOGY: xgen_graph_rag_query, xgen_graph_stats
SERVER: xgen_server_status

When user says a number → find it from previous list. "실행" → execute immediately.`;
  } else {
    prompt += `\nXGEN: Not connected. User can run /connect to connect.`;
  }

  return prompt;
}

// ── 대화 이력 ──
const CONV_DIR = join(homedir(), ".xgen", "conversations");

function ensureConvDir(): void {
  if (!existsSync(CONV_DIR)) mkdirSync(CONV_DIR, { recursive: true });
}

function saveConversation(messages: Message[], name?: string): string {
  ensureConvDir();
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${name || ts}.json`;
  const filepath = join(CONV_DIR, filename);
  // system 프롬프트 제외하고 저장
  const toSave = messages.filter((m) => m.role !== "system");
  writeFileSync(filepath, JSON.stringify(toSave, null, 2), "utf-8");
  return filename;
}

function listConversations(): { name: string; date: string; msgs: number }[] {
  ensureConvDir();
  const files = readdirSync(CONV_DIR).filter((f) => f.endsWith(".json")).sort().reverse();
  return files.slice(0, 20).map((f) => {
    try {
      const data = JSON.parse(readFileSync(join(CONV_DIR, f), "utf-8")) as Message[];
      const userMsgs = data.filter((m) => m.role === "user").length;
      return { name: f.replace(".json", ""), date: f.slice(0, 10), msgs: userMsgs };
    } catch {
      return { name: f.replace(".json", ""), date: "", msgs: 0 };
    }
  });
}

function loadConversation(name: string): Message[] | null {
  const filepath = join(CONV_DIR, `${name}.json`);
  if (!existsSync(filepath)) return null;
  try {
    return JSON.parse(readFileSync(filepath, "utf-8")) as Message[];
  } catch {
    return null;
  }
}

let mcpManager: McpManager | null = null;

// 세션 토큰 추적
const sessionUsage = { prompt: 0, completion: 0, total: 0, calls: 0 };

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function showUsage(usage: TokenUsage | null): void {
  if (!usage || usage.totalTokens === 0) return;
  sessionUsage.prompt += usage.promptTokens;
  sessionUsage.completion += usage.completionTokens;
  sessionUsage.total += usage.totalTokens;
  sessionUsage.calls++;
  console.log(chalk.gray(`  tokens: ${formatTokens(usage.promptTokens)}→${formatTokens(usage.completionTokens)} (session: ${formatTokens(sessionUsage.total)})`));
}

export async function agentRepl(): Promise<void> {
  // ── 로고 ──
  console.log(chalk.cyan(`
   ██████  ██████  ███████ ███    ██
  ██    ██ ██   ██ ██      ████   ██
  ██    ██ ██████  █████   ██ ██  ██
  ██    ██ ██      ██      ██  ██ ██
   ██████  ██      ███████ ██   ████`) +
  chalk.white.bold(`
  ██   ██  ██████  ███████ ███    ██
   ██ ██  ██       ██      ████   ██
    ███   ██   ███ █████   ██ ██  ██
   ██ ██  ██    ██ ██      ██  ██ ██
  ██   ██  ██████  ███████ ██   ████`));
  console.log();

  // ── 1단계: 프로바이더 ──
  let provider = getDefaultProvider();
  if (!provider) {
    provider = await guidedProviderSetup();
    if (!provider) process.exit(1);
  }

  // ── 2단계: XGEN 서버 연결 (미연결이면 자동 가이드) ──
  let server = getServer();
  let auth = getAuth();

  if (!server || !auth) {
    console.log(chalk.yellow("  XGEN 서버에 연결되지 않았습니다."));
    console.log(chalk.gray("  연결하면 워크플로우, 컬렉션, 온톨로지 등 XGEN 기능을 사용할 수 있습니다.\n"));

    const { ask: askOnce } = await import("../utils/ui.js");
    const doConnect = await askOnce(chalk.white("  XGEN 서버에 연결할까요? (Y/n): "));
    if (doConnect.toLowerCase() !== "n") {
      await connectServer();
      server = getServer();
      auth = getAuth();
    } else {
      console.log(chalk.gray("  나중에 /connect 로 연결할 수 있습니다.\n"));
    }
  } else {
    // 저장된 인증이 있으면 유효성 확인
    try {
      const { apiValidate } = await import("../api/auth.js");
      const valid = await apiValidate(auth.accessToken);
      if (!valid.valid) {
        // 토큰 갱신 시도
        const { apiRefresh } = await import("../api/auth.js");
        const refreshed = await apiRefresh(auth.refreshToken);
        if (refreshed.success && refreshed.access_token) {
          const { setAuth } = await import("../config/store.js");
          setAuth({ ...auth, accessToken: refreshed.access_token });
          auth = getAuth();
        }
      }
    } catch {
      // 검증 실패해도 계속 (오프라인일 수 있음)
    }
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
  const env = getActiveEnvironment();

  console.log(chalk.gray(`  model  ${provider.model}`));
  if (server && auth) {
    console.log(chalk.gray(`  xgen   ${chalk.green("●")} ${auth.username}@${server.replace("https://", "").replace("http://", "")}`));
  } else {
    console.log(chalk.gray(`  xgen   ${chalk.red("○")} 미연결`));
  }
  console.log(chalk.gray(`  cwd    ${process.cwd()}`));
  console.log();

  // XGEN 연결 시 자동으로 상태 요약 표시
  if (server && auth) {
    try {
      const [wfRes, colRes] = await Promise.allSettled([
        import("../api/workflow.js").then((m) => m.getWorkflowListDetail()),
        import("../api/document.js").then((m) => m.listCollections()),
      ]);
      const wfCount = wfRes.status === "fulfilled" ? wfRes.value.length : 0;
      const colCount = colRes.status === "fulfilled" ? colRes.value.length : 0;
      const deployed = wfRes.status === "fulfilled" ? wfRes.value.filter((w: Record<string, unknown>) => w.is_deployed).length : 0;
      console.log(chalk.gray(`  ─────────────────────────────────`));
      console.log(chalk.gray(`  워크플로우 ${chalk.white(String(wfCount))}개 (배포 ${deployed}) · 컬렉션 ${chalk.white(String(colCount))}개`));
      console.log(chalk.gray(`  ─────────────────────────────────`));
      console.log();
      console.log(chalk.gray(`  "워크플로우 목록", "컬렉션", "6번 실행" 등 자유롭게 입력`));
      console.log(chalk.gray(`  /dashboard 로 TUI 대시보드 · /help 전체 도움말`));
    } catch {
      console.log(chalk.gray(`  무엇이든 물어보세요. /help`));
    }
  } else {
    console.log(chalk.gray(`  무엇이든 물어보세요. /help`));
  }
  console.log();

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let rlClosed = false;
  rl.on("close", () => { rlClosed = true; });

  const askUser = (): Promise<string> =>
    new Promise((resolve) => {
      if (rlClosed) { resolve("/exit"); return; }
      rl.question(chalk.cyan("  ❯ "), (a) => resolve(a?.trim() ?? "/exit"));
    });

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
  ${chalk.cyan("/connect")}         XGEN 서버 연결 + 로그인
  ${chalk.cyan("/env")}             환경 전환 (본사/제주/롯데몰)
  ${chalk.cyan("/provider")}       프로바이더 변경
  ${chalk.cyan("/dashboard")}      TUI 대시보드 (4분할 화면)
  ${chalk.cyan("/tools")}          사용 가능한 도구 목록
  ${chalk.cyan("/status")}         현재 연결 상태
  ${chalk.cyan("/save [이름]")}    대화 저장
  ${chalk.cyan("/load")}           이전 대화 불러오기
  ${chalk.cyan("/conversations")}  저장된 대화 목록
  ${chalk.cyan("/usage")}          토큰 사용량
  ${chalk.cyan("/clear")}          대화 초기화
  ${chalk.cyan("/exit")}           종료
`);
      continue;
    }

    if (input === "/clear") {
      messages.length = 0;
      messages.push({ role: "system", content: buildSystemPrompt() });
      sessionUsage.prompt = 0; sessionUsage.completion = 0; sessionUsage.total = 0; sessionUsage.calls = 0;
      console.log(chalk.gray("  대화 초기화됨.\n"));
      continue;
    }

    if (input.startsWith("/save")) {
      const name = input.slice(5).trim() || undefined;
      const filename = saveConversation(messages, name);
      console.log(chalk.green(`  ✓ 저장됨: ${filename}\n`));
      continue;
    }

    if (input === "/conversations" || input === "/convs") {
      const convs = listConversations();
      if (!convs.length) {
        console.log(chalk.gray("\n  저장된 대화 없음.\n"));
      } else {
        console.log();
        convs.forEach((c, i) => {
          console.log(`  ${chalk.cyan(`${i + 1}.`)} ${c.name} ${chalk.gray(`(${c.msgs}턴)`)}`);
        });
        console.log();
      }
      continue;
    }

    if (input === "/load") {
      const convs = listConversations();
      if (!convs.length) {
        console.log(chalk.gray("\n  저장된 대화 없음.\n"));
        continue;
      }
      console.log();
      convs.forEach((c, i) => {
        console.log(`  ${chalk.cyan(`${i + 1}.`)} ${c.name} ${chalk.gray(`(${c.msgs}턴)`)}`);
      });
      console.log();
      const choice = await askUser();
      const ci = parseInt(choice) - 1;
      if (ci >= 0 && ci < convs.length) {
        const loaded = loadConversation(convs[ci].name);
        if (loaded) {
          messages.length = 0;
          messages.push({ role: "system", content: buildSystemPrompt() });
          messages.push(...loaded);
          console.log(chalk.green(`  ✓ "${convs[ci].name}" 불러옴 (${loaded.filter((m) => m.role === "user").length}턴)\n`));
        }
      }
      continue;
    }

    if (input === "/usage") {
      console.log(`\n  ${chalk.bold("세션 토큰 사용량")}`);
      console.log(`  프롬프트:  ${formatTokens(sessionUsage.prompt)}`);
      console.log(`  응답:      ${formatTokens(sessionUsage.completion)}`);
      console.log(`  합계:      ${formatTokens(sessionUsage.total)}`);
      console.log(`  API 호출:  ${sessionUsage.calls}회\n`);
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
      rl.pause();
      await connectServer();
      rl.resume();
      messages[0] = { role: "system", content: buildSystemPrompt() };
      continue;
    }

    if (input === "/env") {
      rl.pause();
      await switchEnv();
      rl.resume();
      messages[0] = { role: "system", content: buildSystemPrompt() };
      continue;
    }

    if (input === "/provider") {
      rl.pause();
      const { guidedProviderSetup: setup } = await import("./provider.js");
      await setup();
      rl.resume();
      console.log(chalk.gray("  프로바이더 변경됨. /exit 후 재시작하세요.\n"));
      continue;
    }

    if (input === "/dashboard" || input === "/dash") {
      console.log(chalk.gray("  대시보드 열기...\n"));
      mcpManager?.stopAll();
      rl.close();
      if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
      const { startInkDashboard } = await import("../dashboard/InkDashboard.js");
      await startInkDashboard();
      return;
    }

    // ── AI 대화 ──
    messages.push({ role: "user", content: input });

    try {
      await runLoop(client, provider.model, messages, allTools);
    } catch (err) {
      const msg = (err as Error).message || String(err);
      if (msg.includes("401") || msg.includes("API key") || msg.includes("Unauthorized")) {
        console.log(chalk.red(`\n  ✗ API 키가 유효하지 않습니다. /provider 로 재설정하세요.\n`));
      } else if (msg.includes("429") || msg.includes("rate limit")) {
        console.log(chalk.yellow(`\n  ⚠ 요청 한도 초과. 잠시 후 다시 시도하세요.\n`));
      } else if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
        console.log(chalk.red(`\n  ✗ 프로바이더 서버에 연결할 수 없습니다. URL/네트워크 확인.\n`));
      } else {
        console.log(chalk.red(`\n  오류: ${msg}\n`));
      }
      messages.pop(); // 실패한 user 메시지 제거 (재시도 가능)
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
      showUsage(result.usage);
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
        return s.length > 40 ? s.slice(0, 40) + "…" : s;
      }).join(", ");
      console.log(chalk.dim(`  ┌ ${tc.name}(${shortArgs})`));

      let toolResult: string;
      if (isXgenTool(tc.name)) {
        toolResult = await xgenExecute(tc.name, args);
      } else if (mcpManager?.isMcpTool(tc.name)) {
        toolResult = await mcpManager.callTool(tc.name, args);
      } else {
        toolResult = await executeTool(tc.name, args);
      }

      const truncated = toolResult.length > 8000 ? toolResult.slice(0, 8000) + "\n…(truncated)" : toolResult;
      // 도구 결과 미리보기 (1줄)
      const preview = toolResult.split("\n")[0].slice(0, 60);
      console.log(chalk.dim(`  └ ${preview}${toolResult.length > 60 ? "…" : ""}`));
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
