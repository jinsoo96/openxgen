/**
 * OPEN XGEN TUI 대시보드 — 모노톤
 *
 * ┌──────────────────────────┬───────────────────────────┐
 * │  [워크플로우] [컬렉션]    │  상세 / 로그              │
 * │                          │                           │
 * │  목록                    │                           │
 * │                          │                           │
 * ├──────────────────────────┤                           │
 * │  ❯                      │                           │
 * └──────────────────────────┴───────────────────────────┘
 */
import blessed from "blessed";
import { getServer, getAuth, getDefaultProvider } from "../config/store.js";

interface WfItem { name: string; id: string; deployed: boolean; }
interface ColItem { name: string; id?: number; docs: number; chunks: number; shared: boolean; group?: string; model?: string; }

export async function startTui(): Promise<void> {
  const screen = blessed.screen({ smartCSR: true, title: "OPEN XGEN", fullUnicode: true });

  const provider = getDefaultProvider();
  const server = getServer();
  const auth = getAuth();
  const serverDisplay = auth && server
    ? `${auth.username}@${server.replace("https://", "").replace("http://", "")}`
    : "미연결";

  type TabName = "workflows" | "collections";
  let activeTab: TabName = "workflows";

  // ── 헤더 ──
  const header = blessed.box({
    top: 0, left: 0, width: "100%", height: 3,
    tags: true,
    style: { fg: "white", bg: "black" },
  });

  function renderHeader(): void {
    const wf = activeTab === "workflows" ? "{bold}{underline}워크플로우{/underline}{/bold}" : "{gray-fg}워크플로우{/gray-fg}";
    const col = activeTab === "collections" ? "{bold}{underline}컬렉션{/underline}{/bold}" : "{gray-fg}컬렉션{/gray-fg}";
    header.setContent(` OPEN XGEN  {gray-fg}${provider?.model ?? ""}{/gray-fg}  ${serverDisplay}  │  [1]${wf}  [2]${col}`);
    screen.render();
  }

  // ── 왼쪽: 목록 ──
  const listPanel = blessed.list({
    top: 3, left: 0, width: "50%", height: "100%-9",
    border: { type: "line" },
    style: {
      border: { fg: "gray" },
      selected: { fg: "black", bg: "white" },
      item: { fg: "white" },
      label: { fg: "white", bold: true },
    },
    keys: true, vi: true, mouse: true,
    scrollbar: { ch: "│", style: { fg: "gray" } },
    tags: true,
  });

  // ── 왼쪽 하단: 입력 ──
  const chatInput = blessed.textbox({
    bottom: 3, left: 0, width: "50%", height: 3,
    label: " ❯ ",
    border: { type: "line" },
    inputOnFocus: true,
    style: {
      border: { fg: "gray" },
      label: { fg: "white", bold: true },
    },
  });

  // ── 오른쪽: 상세/로그 ──
  const detailPanel = blessed.log({
    top: 3, left: "50%", width: "50%", height: "100%-6",
    label: " 상세 ",
    border: { type: "line" },
    scrollable: true, alwaysScroll: true, mouse: true, tags: true,
    style: {
      border: { fg: "gray" },
      label: { fg: "white", bold: true },
    },
  });

  // ── 상태 바 ──
  const statusBar = blessed.box({
    bottom: 0, left: 0, width: "100%", height: 3,
    tags: true,
    style: { fg: "gray", bg: "black" },
  });

  function renderStatusBar(msg?: string): void {
    statusBar.setContent(msg ?? " {white-fg}{bold}1/2{/bold}{/white-fg}:탭  {white-fg}{bold}Enter{/bold}{/white-fg}:실행  {white-fg}{bold}i{/bold}{/white-fg}:입력  {white-fg}{bold}r{/bold}{/white-fg}:새로고침  {white-fg}{bold}Esc{/bold}{/white-fg}:목록  {white-fg}{bold}q{/bold}{/white-fg}:종료");
    screen.render();
  }

  screen.append(header);
  screen.append(listPanel);
  screen.append(chatInput);
  screen.append(detailPanel);
  screen.append(statusBar);

  // ── 데이터 ──
  let workflows: WfItem[] = [];
  let collections: ColItem[] = [];

  async function loadWorkflows(): Promise<void> {
    if (!server || !auth) return;
    try {
      const { getWorkflowListDetail } = await import("../api/workflow.js");
      const wfs = await getWorkflowListDetail();
      workflows = wfs.map((w) => ({
        name: w.workflow_name,
        id: (w.workflow_id ?? w.id ?? "").toString(),
        deployed: !!(w as Record<string, unknown>).is_deployed,
      }));
    } catch { workflows = []; }
  }

  async function loadCollections(): Promise<void> {
    if (!server || !auth) return;
    try {
      const { listCollections } = await import("../api/document.js");
      const cols = await listCollections();
      collections = cols.map((c) => ({
        name: c.collection_make_name, id: c.id,
        docs: c.total_documents, chunks: c.total_chunks,
        shared: c.is_shared, group: c.share_group ?? undefined,
        model: c.init_embedding_model ?? undefined,
      }));
    } catch { collections = []; }
  }

  function renderList(): void {
    if (activeTab === "workflows") {
      listPanel.label = ` 워크플로우 (${workflows.length}) `;
      listPanel.setItems(workflows.map((w, i) => {
        const dot = w.deployed ? "●" : "○";
        return ` ${dot} ${String(i + 1).padStart(2)}. ${w.name}`;
      }));
    } else {
      listPanel.label = ` 컬렉션 (${collections.length}) `;
      listPanel.setItems(collections.map((c, i) =>
        `   ${String(i + 1).padStart(2)}. ${c.name}  {gray-fg}${c.docs}문서{/gray-fg}`
      ));
    }
    screen.render();
  }

  async function loadAll(): Promise<void> {
    renderStatusBar(" 로딩...");
    await Promise.all([loadWorkflows(), loadCollections()]);
    renderList();
    renderHeader();
    renderStatusBar();
  }

  // ── 목록 커서 이동 → 상세 ──
  listPanel.on("select item", (_item: unknown, index: number) => {
    if (activeTab === "workflows") {
      const w = workflows[index];
      if (!w) return;
      detailPanel.setContent([
        `{bold}${w.name}{/bold}`,
        ``,
        `ID     ${w.id}`,
        `배포   ${w.deployed ? "Yes" : "No"}`,
        ``,
        `Enter → 실행 입력`,
      ].join("\n"));
    } else {
      const c = collections[index];
      if (!c) return;
      detailPanel.setContent([
        `{bold}${c.name}{/bold}`,
        ``,
        `문서    ${c.docs}개`,
        `청크    ${c.chunks}개`,
        `공유    ${c.shared ? `Yes (${c.group})` : "No"}`,
        `모델    ${c.model ?? "-"}`,
        ``,
        `Enter → 문서 목록`,
      ].join("\n"));
    }
    screen.render();
  });

  // ── Enter ──
  listPanel.on("select", async (_item: unknown, index: number) => {
    if (activeTab === "workflows") {
      const w = workflows[index];
      if (!w) return;
      chatInput.label = ` ${w.name} ❯ `;
      chatInput.focus();
      screen.render();

      chatInput.once("submit", async (value: string) => {
        if (!value.trim()) {
          chatInput.label = " ❯ ";
          chatInput.clearValue();
          listPanel.focus();
          screen.render();
          return;
        }

        detailPanel.log(`{gray-fg}── ${w.name} ──{/gray-fg}`);
        detailPanel.log(`입력: ${value}`);
        screen.render();

        try {
          const { executeWorkflow } = await import("../api/workflow.js");
          const { randomUUID } = await import("node:crypto");
          const result = await executeWorkflow({
            workflow_id: w.id, workflow_name: w.name,
            input_data: value, interaction_id: `tui_${randomUUID().slice(0, 8)}`,
            user_id: auth?.userId ? parseInt(auth.userId) : 1,
          }) as Record<string, unknown>;

          if (result.content) {
            detailPanel.log(`${String(result.content)}\n`);
          } else if (result.error || result.message) {
            detailPanel.log(`오류: ${result.error ?? result.message}\n`);
          } else {
            detailPanel.log(JSON.stringify(result, null, 2).slice(0, 800) + "\n");
          }
        } catch (err) {
          detailPanel.log(`실패: ${(err as Error).message}\n`);
        }

        chatInput.label = " ❯ ";
        chatInput.clearValue();
        listPanel.focus();
        screen.render();
      });
    } else {
      const c = collections[index];
      if (!c) return;
      detailPanel.setContent(`${c.name} 문서 로딩...`);
      screen.render();

      try {
        const { listDocuments } = await import("../api/document.js");
        const docs = await listDocuments(c.id?.toString());
        if (!docs.length) {
          detailPanel.setContent(`{bold}${c.name}{/bold}\n\n문서 없음`);
        } else {
          const docList = docs.map((d, i) => {
            const name = (d as Record<string, unknown>).name || (d as Record<string, unknown>).file_name || "이름 없음";
            return `  ${i + 1}. ${name}`;
          }).join("\n");
          detailPanel.setContent(`{bold}${c.name}{/bold} — ${docs.length}개 문서\n\n${docList}`);
        }
      } catch (err) {
        detailPanel.setContent(`문서 로드 실패: ${(err as Error).message}`);
      }
      screen.render();
    }
  });

  // ── 자유 채팅 ──
  chatInput.on("submit", async (value: string) => {
    if (!value.trim()) { chatInput.clearValue(); listPanel.focus(); screen.render(); return; }
    detailPanel.log(`{white-fg}❯ ${value}{/white-fg}`);
    chatInput.clearValue();
    screen.render();

    try {
      const p = getDefaultProvider();
      if (!p) { detailPanel.log("프로바이더 미설정"); chatInput.focus(); screen.render(); return; }
      const { createLLMClient, streamChat } = await import("../agent/llm.js");
      const client = createLLMClient(p);
      const result = await streamChat(client, p.model, [
        { role: "system", content: "You are OPEN XGEN. Concise. Korean." },
        { role: "user", content: value },
      ]);
      detailPanel.log(`${result.content || "(응답 없음)"}\n`);
    } catch (err) {
      detailPanel.log(`오류: ${(err as Error).message}\n`);
    }
    chatInput.focus();
    screen.render();
  });

  // ── 키바인딩 ──
  screen.key(["1"], () => { activeTab = "workflows"; renderList(); renderHeader(); listPanel.focus(); });
  screen.key(["2"], () => { activeTab = "collections"; renderList(); renderHeader(); listPanel.focus(); });
  screen.key(["tab"], () => {
    if (screen.focused === listPanel) chatInput.focus(); else listPanel.focus();
    screen.render();
  });
  screen.key(["i"], () => { chatInput.focus(); screen.render(); });
  screen.key(["r"], async () => { await loadAll(); });
  screen.key(["escape"], () => { chatInput.label = " ❯ "; listPanel.focus(); screen.render(); });
  screen.key(["q", "C-c"], () => { screen.destroy(); process.exit(0); });

  setInterval(async () => { try { await loadAll(); } catch {} }, 60_000);

  await loadAll();
  listPanel.focus();
  screen.render();
}
