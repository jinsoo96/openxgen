/**
 * OPEN XGEN 대시보드 — 탭 기반 인터랙티브 TUI
 *
 * Tab 키로 섹션 전환, 숫자로 선택, Enter로 실행
 * AI 채팅은 기본 탭
 */
import chalk from "chalk";
import { createInterface } from "node:readline";
import { clearScreen, renderHeader, renderStatusBar, renderList, renderPanel, type ListItem } from "./renderer.js";
import { getServer, getAuth, getDefaultProvider, getActiveEnvironment } from "../config/store.js";
import { agentRepl } from "../commands/agent.js";

const TABS = ["💬 Chat", "📋 Workflows", "📄 Documents", "🔍 Ontology", "⚙ Settings"];

interface DashboardState {
  activeTab: number;
  workflows: ListItem[];
  documents: ListItem[];
  selectedIdx: number;
}

export async function dashboard(): Promise<void> {
  const state: DashboardState = {
    activeTab: 0,
    workflows: [],
    documents: [],
    selectedIdx: 0,
  };

  // 첫 화면: 데이터 로드
  await loadData(state);
  render(state);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // 키 입력 raw mode
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", async (key: string) => {
      // Ctrl+C
      if (key === "\u0003") {
        cleanup(rl);
        process.exit(0);
      }

      // Tab — 다음 탭
      if (key === "\t") {
        state.activeTab = (state.activeTab + 1) % TABS.length;
        state.selectedIdx = 0;
        render(state);
        return;
      }

      // Shift+Tab — 이전 탭 (ESC [ Z)
      if (key === "\x1b[Z") {
        state.activeTab = (state.activeTab - 1 + TABS.length) % TABS.length;
        state.selectedIdx = 0;
        render(state);
        return;
      }

      // 위/아래 화살표
      if (key === "\x1b[A") { // Up
        state.selectedIdx = Math.max(0, state.selectedIdx - 1);
        render(state);
        return;
      }
      if (key === "\x1b[B") { // Down
        const max = getCurrentListLength(state) - 1;
        state.selectedIdx = Math.min(max, state.selectedIdx + 1);
        render(state);
        return;
      }

      // Enter
      if (key === "\r") {
        await handleEnter(state, rl);
        return;
      }

      // 숫자 1-5 → 탭 전환
      const num = parseInt(key);
      if (num >= 1 && num <= 5) {
        state.activeTab = num - 1;
        state.selectedIdx = 0;
        render(state);
        return;
      }

      // 'c' → 채팅 탭
      if (key === "c") { state.activeTab = 0; render(state); return; }
      // 'w' → 워크플로우
      if (key === "w") { state.activeTab = 1; render(state); return; }
      // 'd' → 문서
      if (key === "d") { state.activeTab = 2; render(state); return; }
      // 'o' → 온톨로지
      if (key === "o") { state.activeTab = 3; render(state); return; }
      // 's' → 설정
      if (key === "s") { state.activeTab = 4; render(state); return; }

      // 'r' → 새로고침
      if (key === "r") {
        await loadData(state);
        render(state);
        return;
      }

      // 'q' → 종료
      if (key === "q") {
        cleanup(rl);
        process.exit(0);
      }
    });
  } else {
    // non-TTY fallback → 에이전트 모드
    cleanup(rl);
    await agentRepl();
  }
}

function render(state: DashboardState): void {
  clearScreen();

  const env = getActiveEnvironment();
  const auth = getAuth();
  const server = getServer();
  const envLabel = env?.name ?? (server ? server.replace("https://", "") : "미연결");
  const userLabel = auth ? `${auth.username}@${envLabel}` : envLabel;

  renderHeader(TABS[state.activeTab], TABS, userLabel);
  console.log();

  switch (state.activeTab) {
    case 0: renderChatTab(); break;
    case 1: renderWorkflowTab(state); break;
    case 2: renderDocTab(state); break;
    case 3: renderOntologyTab(); break;
    case 4: renderSettingsTab(); break;
  }

  const provider = getDefaultProvider();
  const statusText = `${provider?.name ?? "AI 미설정"} · ${provider?.model ?? ""} │ Tab:전환 ↑↓:선택 Enter:실행 r:새로고침 q:종료`;
  renderStatusBar(statusText);
}

function renderChatTab(): void {
  console.log(chalk.bold("  AI 에이전트"));
  console.log();
  console.log(chalk.gray("  Enter를 눌러 AI 채팅 모드로 진입합니다."));
  console.log(chalk.gray("  채팅에서 워크플로우 실행, 파일 편집, 코드 실행 모두 가능합니다."));
  console.log();
  console.log(chalk.gray("  예시:"));
  console.log(chalk.white('    "워크플로우 목록 보여줘"'));
  console.log(chalk.white('    "재직증명서 워크플로우 실행해줘"'));
  console.log(chalk.white('    "이 폴더에 있는 파일 뭐 있어?"'));
  console.log(chalk.white('    "Python으로 fibonacci 함수 만들어줘"'));
  console.log();
}

function renderWorkflowTab(state: DashboardState): void {
  if (state.workflows.length === 0) {
    console.log(chalk.gray("  서버 미연결 또는 워크플로우 없음"));
    console.log(chalk.gray("  s키 → 설정에서 서버 연결"));
    return;
  }
  renderList(state.workflows, state.selectedIdx, `워크플로우 (${state.workflows.length}개)`);
}

function renderDocTab(state: DashboardState): void {
  if (state.documents.length === 0) {
    console.log(chalk.gray("  서버 미연결 또는 문서 없음"));
    return;
  }
  renderList(state.documents, state.selectedIdx, `문서 (${state.documents.length}개)`);
}

function renderOntologyTab(): void {
  console.log(chalk.bold("  온톨로지 (GraphRAG)"));
  console.log();
  console.log(chalk.gray("  Enter를 눌러 온톨로지 질의 모드로 진입합니다."));
  console.log(chalk.gray("  지식 그래프 기반 질문-답변을 수행합니다."));
  console.log();
}

function renderSettingsTab(): void {
  const provider = getDefaultProvider();
  const server = getServer();
  const auth = getAuth();
  const env = getActiveEnvironment();

  const lines = [
    `프로바이더: ${provider ? `${provider.name} · ${provider.model}` : chalk.red("미설정")}`,
    `서버:       ${server ?? chalk.red("미연결")}`,
    `사용자:     ${auth?.username ?? "-"}`,
    `환경:       ${env?.name ?? "-"}`,
  ];
  renderPanel("현재 설정", lines);
  console.log();
  console.log(chalk.gray("  Enter → AI 채팅에서 /connect, /provider, /env 사용"));
}

function getCurrentListLength(state: DashboardState): number {
  switch (state.activeTab) {
    case 1: return state.workflows.length;
    case 2: return state.documents.length;
    default: return 0;
  }
}

async function handleEnter(state: DashboardState, rl: ReturnType<typeof createInterface>): Promise<void> {
  if (state.activeTab === 0 || state.activeTab === 3 || state.activeTab === 4) {
    // 채팅/온톨로지/설정 → 에이전트 모드 진입
    cleanup(rl);
    await agentRepl();
    // 에이전트에서 돌아오면 다시 대시보드
    await dashboard();
    return;
  }

  if (state.activeTab === 1 && state.workflows.length > 0) {
    // 워크플로우 선택 → 에이전트에서 실행
    const selected = state.workflows[state.selectedIdx];
    cleanup(rl);
    // 선택된 워크플로우 정보와 함께 에이전트 시작
    console.log(chalk.green(`\n  ✓ ${selected.label} 선택됨\n`));
    await agentRepl();
    await dashboard();
    return;
  }
}

async function loadData(state: DashboardState): Promise<void> {
  const server = getServer();
  const auth = getAuth();
  if (!server || !auth) return;

  try {
    const { getWorkflowListDetail } = await import("../api/workflow.js");
    const wfs = await getWorkflowListDetail();
    state.workflows = wfs.map((w) => {
      const deployed = (w as Record<string, unknown>).is_deployed;
      return {
        label: w.workflow_name,
        detail: (w.workflow_id ?? w.id ?? "").toString(),
        tag: deployed ? chalk.green("[배포]") : undefined,
      };
    });
  } catch { /* 워크플로우 로드 실패 무시 */ }

  try {
    const { listDocuments } = await import("../api/document.js");
    const docs = await listDocuments();
    state.documents = docs.map((d) => ({
      label: d.file_name ?? d.name ?? "-",
      detail: d.file_type ?? "-",
      tag: d.status ? chalk.gray(`[${d.status}]`) : undefined,
    }));
  } catch { /* 문서 로드 실패 무시 */ }
}

function cleanup(rl: ReturnType<typeof createInterface>): void {
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  rl.close();
  clearScreen();
}
