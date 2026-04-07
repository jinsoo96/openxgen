/**
 * OPEN XGEN Raw TUI — ANSI escape 직접 구현
 * blessed/Ink 없이 process.stdin raw mode + ANSI로 대시보드 구현
 */
import { getServer, getAuth, getDefaultProvider } from "../config/store.js";

type Tab = "workflows" | "collections" | "nodes" | "prompts" | "tools";

interface ListItem { label: string; sub?: string; }

const TABS: { key: Tab; label: string; num: string }[] = [
  { key: "workflows", label: "워크플로우", num: "1" },
  { key: "collections", label: "컬렉션", num: "2" },
  { key: "nodes", label: "노드", num: "3" },
  { key: "prompts", label: "프롬프트", num: "4" },
  { key: "tools", label: "도구", num: "5" },
];

// ANSI helpers
const CSI = "\x1b[";
const clear = () => process.stdout.write(`${CSI}2J${CSI}H`);
const moveTo = (r: number, c: number) => process.stdout.write(`${CSI}${r};${c}H`);
const dim = (s: string) => `${CSI}2m${s}${CSI}0m`;
const bold = (s: string) => `${CSI}1m${s}${CSI}0m`;
const inverse = (s: string) => `${CSI}7m${s}${CSI}0m`;
const hideCursor = () => process.stdout.write(`${CSI}?25l`);
const showCursor = () => process.stdout.write(`${CSI}?25h`);

export async function startRawTui(): Promise<void> {
  const provider = getDefaultProvider();
  const server = getServer();
  const auth = getAuth();
  const serverDisplay = auth && server
    ? `${auth.username}@${server.replace("https://", "").replace("http://", "")}`
    : "미연결";

  let tab: Tab = "workflows";
  let selected = 0;
  let inputMode = false;
  let inputBuffer = "";
  let runTarget: { name: string; id: string } | null = null;

  // 데이터
  let workflows: { name: string; id: string; deployed: boolean }[] = [];
  let collections: { name: string; docs: number; chunks: number }[] = [];
  let nodes: { name: string; desc: string }[] = [];
  let prompts: { name: string; type: string }[] = [];
  let tools: { name: string; desc: string }[] = [];
  let detail: string[] = ["← 항목을 선택하세요"];
  let statusMsg = "로딩...";

  async function loadData() {
    statusMsg = "로딩...";
    render();
    if (!server || !auth) { statusMsg = "서버 미연결"; render(); return; }
    try {
      const [wfMod, docMod, extraMod] = await Promise.all([
        import("../api/workflow.js"),
        import("../api/document.js"),
        import("../api/xgen-extra.js"),
      ]);
      const [wfR, colR, nodeR, promptR, toolR] = await Promise.allSettled([
        wfMod.getWorkflowListDetail(),
        docMod.listCollections(),
        extraMod.listNodes(),
        extraMod.listPrompts(),
        extraMod.listToolStore(),
      ]);
      if (wfR.status === "fulfilled") workflows = wfR.value.map((w: any) => ({ name: w.workflow_name, id: w.workflow_id ?? w.id ?? "", deployed: !!w.is_deployed }));
      if (colR.status === "fulfilled") collections = colR.value.map((c: any) => ({ name: c.collection_make_name, docs: c.total_documents, chunks: c.total_chunks }));
      if (nodeR.status === "fulfilled") nodes = (nodeR.value as any[]).map((n: any) => ({ name: n.nodeName ?? n.name ?? "?", desc: (n.description ?? "").slice(0, 40) }));
      if (promptR.status === "fulfilled") prompts = (promptR.value as any[]).map((p: any) => ({ name: p.name ?? p.title ?? "?", type: p.prompt_type ?? "" }));
      if (toolR.status === "fulfilled") tools = (toolR.value as any[]).map((t: any) => ({ name: t.name ?? t.tool_name ?? "?", desc: (t.description ?? "").slice(0, 40) }));
    } catch {}
    statusMsg = "↑↓:이동  Enter:선택/실행  1-5:탭  i:입력  r:새로고침  q:종료";
    render();
  }

  function getItems(): ListItem[] {
    switch (tab) {
      case "workflows": return workflows.map(w => ({ label: `${w.deployed ? "●" : "○"} ${w.name}`, sub: w.id.slice(0, 20) }));
      case "collections": return collections.map(c => ({ label: c.name, sub: `${c.docs}문서 ${c.chunks}청크` }));
      case "nodes": return nodes.map(n => ({ label: n.name, sub: n.desc }));
      case "prompts": return prompts.map(p => ({ label: p.name, sub: `[${p.type}]` }));
      case "tools": return tools.map(t => ({ label: t.name, sub: t.desc }));
    }
  }

  function updateDetail() {
    const items = getItems();
    if (selected < 0 || selected >= items.length) return;
    if (tab === "workflows" && workflows[selected]) {
      const w = workflows[selected];
      detail = [bold(w.name), "", `ID    ${w.id}`, `배포  ${w.deployed ? "Yes" : "No"}`, "", "Enter → 실행"];
    } else if (tab === "collections" && collections[selected]) {
      const c = collections[selected];
      detail = [bold(c.name), "", `문서  ${c.docs}개`, `청크  ${c.chunks}개`];
    } else if (tab === "nodes" && nodes[selected]) {
      const n = nodes[selected];
      detail = [bold(n.name), "", n.desc];
    } else if (tab === "prompts" && prompts[selected]) {
      const p = prompts[selected];
      detail = [bold(p.name), `[${p.type}]`];
    } else if (tab === "tools" && tools[selected]) {
      const t = tools[selected];
      detail = [bold(t.name), "", t.desc];
    }
  }

  function render() {
    const cols = process.stdout.columns || 120;
    const rows = process.stdout.rows || 30;
    const leftW = Math.floor(cols / 2);
    const rightW = cols - leftW;
    const listH = rows - 5; // header 2 + input 1 + status 1 + margin 1

    clear();

    // Header
    moveTo(1, 1);
    const tabStr = TABS.map(t => {
      const active = tab === t.key;
      return `[${t.num}]${active ? bold("▸" + t.label) : dim(t.label)}`;
    }).join("  ");
    process.stdout.write(` ${bold("OPEN XGEN")}  ${dim(provider?.model ?? "")}  ${serverDisplay}  │  ${tabStr}`);

    // Separator
    moveTo(2, 1);
    process.stdout.write(dim("─".repeat(cols)));

    // Left panel — list
    const items = getItems();
    const visibleCount = listH;
    const scrollStart = Math.max(0, Math.min(selected - Math.floor(visibleCount / 2), items.length - visibleCount));

    for (let i = 0; i < visibleCount; i++) {
      moveTo(3 + i, 1);
      const idx = scrollStart + i;
      if (idx < items.length) {
        const item = items[idx];
        const prefix = idx === selected ? "▸ " : "  ";
        const line = `${prefix}${String(idx + 1).padStart(2)}. ${item.label}`;
        const trimmed = line.slice(0, leftW - 2);
        process.stdout.write(idx === selected ? inverse(trimmed.padEnd(leftW - 1)) : trimmed);
      } else {
        process.stdout.write(" ".repeat(leftW - 1));
      }

      // Separator column
      process.stdout.write(dim("│"));

      // Right panel — detail
      if (i < detail.length) {
        const dline = detail[i].slice(0, rightW - 2);
        process.stdout.write(` ${dline}`);
      }
    }

    // Input bar
    moveTo(rows - 2, 1);
    process.stdout.write(dim("─".repeat(cols)));
    moveTo(rows - 1, 1);
    if (inputMode) {
      const prompt = runTarget ? `${runTarget.name} ❯ ` : "❯ ";
      process.stdout.write(` ${prompt}${inputBuffer}`);
      showCursor();
    } else {
      process.stdout.write(dim(" ❯ i를 눌러 입력 · Enter로 실행"));
      hideCursor();
    }

    // Status bar
    moveTo(rows, 1);
    process.stdout.write(dim(` ${statusMsg}`.slice(0, cols)));
  }

  async function executeWorkflowAction(wf: { name: string; id: string }, input: string) {
    detail = [`실행 중: ${wf.name}`, `입력: ${input}`, "", "..."];
    render();
    try {
      const { executeWorkflow } = await import("../api/workflow.js");
      const { randomUUID } = await import("node:crypto");
      const r = await executeWorkflow({
        workflow_id: wf.id, workflow_name: wf.name,
        input_data: input, interaction_id: `tui_${randomUUID().slice(0, 8)}`,
        user_id: auth?.userId ? parseInt(auth.userId) : 1,
      }) as any;
      const content = r.content ?? r.message ?? JSON.stringify(r).slice(0, 500);
      // 결과를 줄 단위로 분리
      detail = [bold(wf.name), "", `입력: ${input}`, "", "결과:", ...String(content).split("\n").slice(0, 15)];
    } catch (err) {
      detail = [`실행 실패: ${(err as Error).message}`];
    }
    render();
  }

  function handleKey(data: Buffer) {
    const s = data.toString();

    if (inputMode) {
      if (s === "\x1b" || s === "\x1b\x1b") { // Escape
        inputMode = false; inputBuffer = ""; runTarget = null; render(); return;
      }
      if (s === "\r" || s === "\n") { // Enter
        const val = inputBuffer.trim();
        inputMode = false; inputBuffer = "";
        if (val && runTarget) {
          executeWorkflowAction(runTarget, val);
          runTarget = null;
        }
        render(); return;
      }
      if (s === "\x7f" || s === "\b") { // Backspace
        inputBuffer = inputBuffer.slice(0, -1); render(); return;
      }
      // 일반 문자 입력
      if (s.length > 0 && s.charCodeAt(0) >= 32) {
        inputBuffer += s; render(); return;
      }
      return;
    }

    // 일반 모드
    if (s === "q" || s === "\x03") { // q or Ctrl+C
      cleanup(); process.exit(0);
    }
    if (s === "r") { loadData(); return; }
    if (s === "i") { inputMode = true; render(); return; }

    // 탭 전환
    const tabNum = parseInt(s);
    if (tabNum >= 1 && tabNum <= 5) {
      tab = TABS[tabNum - 1].key;
      selected = 0;
      updateDetail();
      render();
      return;
    }

    // Tab key
    if (s === "\t") {
      const idx = TABS.findIndex(t => t.key === tab);
      tab = TABS[(idx + 1) % TABS.length].key;
      selected = 0;
      updateDetail();
      render();
      return;
    }

    // Arrow keys
    if (s === "\x1b[A") { // Up
      const items = getItems();
      selected = Math.max(0, selected - 1);
      updateDetail(); render(); return;
    }
    if (s === "\x1b[B") { // Down
      const items = getItems();
      selected = Math.min(items.length - 1, selected + 1);
      updateDetail(); render(); return;
    }

    // Enter
    if (s === "\r" || s === "\n") {
      if (tab === "workflows" && workflows[selected]) {
        runTarget = workflows[selected];
        inputMode = true;
        statusMsg = `${runTarget.name} — 입력 후 Enter 실행, Esc 취소`;
        render();
      } else if (tab === "collections" && collections[selected]) {
        // 컬렉션 선택 → 문서 로드
        const c = collections[selected];
        detail = [`${c.name} 문서 로딩...`];
        render();
        import("../api/document.js").then(async (m) => {
          try {
            const docs = await m.listDocuments(String((collections[selected] as any).id ?? ""));
            if (!docs.length) { detail = [bold(c.name), "", "문서 없음"]; }
            else {
              detail = [bold(c.name) + ` — ${docs.length}개 문서`, "", ...docs.map((d, i) =>
                `  ${i + 1}. ${(d as any).name || (d as any).file_name || "이름없음"}`
              ).slice(0, 15)];
            }
          } catch (err) { detail = [`문서 로드 실패: ${(err as Error).message}`]; }
          render();
        });
      }
      return;
    }
  }

  function cleanup() {
    showCursor();
    clear();
    if (process.stdin.isTTY && process.stdin.isRaw) {
      process.stdin.setRawMode(false);
    }
    process.stdin.removeAllListeners("data");
    process.stdin.pause();
  }

  // === 시작 ===
  if (!process.stdin.isTTY) {
    console.error("대시보드는 터미널(TTY)에서만 실행 가능합니다.");
    return;
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  hideCursor();

  process.stdin.on("data", (data: Buffer) => {
    try { handleKey(data); } catch {}
  });

  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("exit", () => { showCursor(); });

  await loadData();

  // 유지 — stdin이 열려있으면 프로세스 안 끝남
  await new Promise<void>(() => {});
}
