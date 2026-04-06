/**
 * OPEN XGEN TUI 대시보드 — blessed 기반 화면 분할
 *
 * ┌─────────────────────┬──────────────────────┐
 * │  워크플로우 목록      │  상세 정보 / 실행     │
 * │  (화살표 선택)       │                      │
 * │                     │                      │
 * ├─────────────────────┼──────────────────────┤
 * │  컬렉션 / 문서       │  AI 채팅             │
 * │                     │  (입력 + 응답)        │
 * │                     │                      │
 * └─────────────────────┴──────────────────────┘
 * [Tab: 패널 전환] [Enter: 선택/실행] [q: 종료]
 */
import blessed from "blessed";
import { getServer, getAuth, getDefaultProvider, getActiveEnvironment } from "../config/store.js";

// 타입
interface WfItem {
  name: string;
  id: string;
  deployed: boolean;
  deployKey?: string;
  nodeCount?: number;
}

interface ColItem {
  name: string;
  docs: number;
  chunks: number;
  shared: boolean;
  group?: string;
}

export async function startTui(): Promise<void> {
  const screen = blessed.screen({
    smartCSR: true,
    title: "OPEN XGEN",
    fullUnicode: true,
  });

  const provider = getDefaultProvider();
  const server = getServer();
  const auth = getAuth();
  const env = getActiveEnvironment();

  // ── 헤더 ──
  const header = blessed.box({
    top: 0, left: 0, width: "100%", height: 3,
    content: `{center}{bold}OPEN XGEN{/bold}  ${provider?.model ?? "AI 미설정"} · ${auth?.username ?? "미연결"}@${env?.name ?? server?.replace("https://", "") ?? ""}{/center}`,
    tags: true,
    style: { fg: "white", bg: "blue" },
  });

  // ── 왼쪽 상단: 워크플로우 ──
  const wfPanel = blessed.list({
    top: 3, left: 0, width: "50%", height: "50%-2",
    label: " 워크플로우 ",
    border: { type: "line" },
    style: {
      border: { fg: "cyan" },
      selected: { fg: "black", bg: "cyan" },
      item: { fg: "white" },
      label: { fg: "cyan", bold: true },
    },
    keys: true,
    vi: true,
    mouse: true,
    scrollbar: { ch: "│", style: { fg: "cyan" } },
    tags: true,
  });

  // ── 오른쪽 상단: 상세/실행 결과 ──
  const detailPanel = blessed.box({
    top: 3, left: "50%", width: "50%", height: "50%-2",
    label: " 상세 ",
    border: { type: "line" },
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    tags: true,
    style: {
      border: { fg: "green" },
      label: { fg: "green", bold: true },
    },
  });

  // ── 왼쪽 하단: 컬렉션 ──
  const colPanel = blessed.list({
    top: "50%+1", left: 0, width: "50%", height: "50%-4",
    label: " 컬렉션 (문서) ",
    border: { type: "line" },
    style: {
      border: { fg: "yellow" },
      selected: { fg: "black", bg: "yellow" },
      item: { fg: "white" },
      label: { fg: "yellow", bold: true },
    },
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
  });

  // ── 오른쪽 하단: AI 채팅 ──
  const chatLog = blessed.log({
    top: "50%+1", left: "50%", width: "50%", height: "50%-7",
    label: " AI 채팅 ",
    border: { type: "line" },
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    tags: true,
    style: {
      border: { fg: "magenta" },
      label: { fg: "magenta", bold: true },
    },
  });

  // ── 채팅 입력 ──
  const chatInput = blessed.textbox({
    bottom: 3, left: "50%", width: "50%", height: 3,
    label: " 입력 ",
    border: { type: "line" },
    inputOnFocus: true,
    style: {
      border: { fg: "magenta" },
      label: { fg: "magenta" },
    },
  });

  // ── 상태 바 ──
  const statusBar = blessed.box({
    bottom: 0, left: 0, width: "100%", height: 3,
    content: " {bold}Tab{/bold}:패널전환  {bold}Enter{/bold}:선택  {bold}r{/bold}:새로고침  {bold}c{/bold}:채팅  {bold}q{/bold}:종료  {bold}↑↓{/bold}:이동",
    tags: true,
    style: { fg: "white", bg: "gray" },
  });

  screen.append(header);
  screen.append(wfPanel);
  screen.append(detailPanel);
  screen.append(colPanel);
  screen.append(chatLog);
  screen.append(chatInput);
  screen.append(statusBar);

  // ── 데이터 ──
  let workflows: WfItem[] = [];
  let collections: ColItem[] = [];

  async function loadData(): Promise<void> {
    if (!server || !auth) {
      wfPanel.setItems(["서버 미연결 — q 종료 후 xgen agent → /connect"]);
      colPanel.setItems(["서버 미연결"]);
      screen.render();
      return;
    }

    statusBar.setContent(" 로딩 중...");
    screen.render();

    try {
      const { getWorkflowListDetail } = await import("../api/workflow.js");
      const wfs = await getWorkflowListDetail();
      workflows = wfs.map((w) => ({
        name: w.workflow_name,
        id: (w.workflow_id ?? w.id ?? "").toString(),
        deployed: !!(w as Record<string, unknown>).is_deployed,
        deployKey: (w as Record<string, unknown>).deploy_key as string | undefined,
        nodeCount: (w as Record<string, unknown>).node_count as number | undefined,
      }));
      wfPanel.setItems(workflows.map((w) => {
        const tag = w.deployed ? "{green-fg}[배포]{/green-fg}" : "";
        return ` ${w.name} ${tag}`;
      }));
    } catch (err) {
      wfPanel.setItems([`오류: ${(err as Error).message}`]);
    }

    try {
      const { listCollections } = await import("../api/document.js");
      const cols = await listCollections();
      collections = cols.map((c) => ({
        name: c.collection_make_name,
        docs: c.total_documents,
        chunks: c.total_chunks,
        shared: c.is_shared,
        group: c.share_group ?? undefined,
      }));
      colPanel.setItems(collections.map((c) => {
        const shared = c.shared ? `{yellow-fg}[${c.group}]{/yellow-fg}` : "";
        return ` ${c.name} ${shared} — ${c.docs}문서 ${c.chunks}청크`;
      }));
    } catch {
      colPanel.setItems(["컬렉션 로드 실패"]);
    }

    statusBar.setContent(" {bold}Tab{/bold}:패널전환  {bold}Enter{/bold}:선택  {bold}r{/bold}:새로고침  {bold}c{/bold}:채팅  {bold}q{/bold}:종료  {bold}↑↓{/bold}:이동");
    screen.render();
  }

  // ── 워크플로우 선택 시 상세 표시 ──
  wfPanel.on("select item", (_item: unknown, index: number) => {
    const w = workflows[index];
    if (!w) return;
    detailPanel.setContent([
      `{bold}${w.name}{/bold}`,
      "",
      `ID: ${w.id}`,
      `배포: ${w.deployed ? "{green-fg}Yes{/green-fg}" : "No"}`,
      w.deployKey ? `Deploy Key: ${w.deployKey}` : "",
      w.nodeCount ? `노드: ${w.nodeCount}개` : "",
      "",
      w.deployed ? "{green-fg}Enter로 실행{/green-fg}" : "{gray-fg}미배포 — 실행 불가{/gray-fg}",
    ].filter(Boolean).join("\n"));
    screen.render();
  });

  // ── 워크플로우 실행 (Enter) ──
  wfPanel.on("select", async (_item: unknown, index: number) => {
    const w = workflows[index];
    if (!w || !w.deployed || !w.deployKey) {
      detailPanel.setContent("{red-fg}배포된 워크플로우만 실행 가능합니다.{/red-fg}");
      screen.render();
      return;
    }
    detailPanel.setContent(`{yellow-fg}${w.name} 실행 중...{/yellow-fg}`);
    screen.render();

    try {
      const { executeWorkflow } = await import("../api/workflow.js");
      const { randomUUID } = await import("node:crypto");
      const result = await executeWorkflow({
        workflow_id: w.id,
        workflow_name: w.name,
        input_data: "테스트 실행",
        interaction_id: `cli_${randomUUID().slice(0, 8)}`,
        deploy_key: w.deployKey,
      }) as Record<string, unknown>;

      if (result.content) {
        detailPanel.setContent(`{green-fg}결과:{/green-fg}\n\n${String(result.content).slice(0, 500)}`);
      } else if (result.error) {
        detailPanel.setContent(`{red-fg}오류:{/red-fg} ${result.error}`);
      } else {
        detailPanel.setContent(JSON.stringify(result, null, 2).slice(0, 500));
      }
    } catch (err) {
      detailPanel.setContent(`{red-fg}실행 실패:{/red-fg} ${(err as Error).message}`);
    }
    screen.render();
  });

  // ── 컬렉션 선택 ──
  colPanel.on("select item", (_item: unknown, index: number) => {
    const c = collections[index];
    if (!c) return;
    detailPanel.setContent([
      `{bold}${c.name}{/bold}`,
      "",
      `문서: ${c.docs}개`,
      `청크: ${c.chunks}개`,
      `공유: ${c.shared ? `Yes (${c.group})` : "No"}`,
    ].join("\n"));
    screen.render();
  });

  // ── 채팅 ──
  chatInput.on("submit", async (value: string) => {
    if (!value.trim()) { chatInput.clearValue(); chatInput.focus(); screen.render(); return; }
    chatLog.log(`{blue-fg}You:{/blue-fg} ${value}`);
    chatInput.clearValue();
    screen.render();

    try {
      const provider = getDefaultProvider();
      if (!provider) {
        chatLog.log("{red-fg}프로바이더 미설정{/red-fg}");
        chatInput.focus();
        screen.render();
        return;
      }

      const { createLLMClient, streamChat } = await import("../agent/llm.js");
      const client = createLLMClient(provider);
      const result = await streamChat(client, provider.model, [
        { role: "system", content: "You are OPEN XGEN. Be concise. Respond in Korean. Max 3 sentences." },
        { role: "user", content: value },
      ]);
      chatLog.log(`{green-fg}AI:{/green-fg} ${result.content || "(no response)"}`);
    } catch (err) {
      chatLog.log(`{red-fg}오류:{/red-fg} ${(err as Error).message}`);
    }

    chatInput.focus();
    screen.render();
  });

  // ── 키바인딩 ──
  const panels = [wfPanel, colPanel, chatInput];
  let activePanel = 0;

  function focusPanel(idx: number): void {
    activePanel = idx;
    panels[idx].focus();
    screen.render();
  }

  screen.key(["tab"], () => {
    activePanel = (activePanel + 1) % panels.length;
    focusPanel(activePanel);
  });

  screen.key(["S-tab"], () => {
    activePanel = (activePanel - 1 + panels.length) % panels.length;
    focusPanel(activePanel);
  });

  screen.key(["r"], async () => { await loadData(); });
  screen.key(["c"], () => { focusPanel(2); });
  screen.key(["q", "C-c"], () => { screen.destroy(); process.exit(0); });

  // ── 자동 새로고침 (30초마다) ──
  setInterval(async () => {
    try { await loadData(); } catch { /* ignore */ }
  }, 30_000);

  // 초기 로드
  await loadData();
  focusPanel(0);
  screen.render();
}
