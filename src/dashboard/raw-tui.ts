/**
 * OPEN XGEN TUI Dashboard v3 — 3분할 레이아웃
 * 왼쪽 위: 탭별 목록
 * 오른쪽 위: 샌드박스 (상세/테스트/결과)
 * 아래 전체: 채팅 + 결과
 */
import { getServer, getAuth, getDefaultProvider } from "../config/store.js";

type Tab = "workflows" | "collections" | "nodes" | "prompts" | "tools" | "mcp";
interface ListItem { label: string; sub?: string; }

const TABS: { key: Tab; label: string; num: string }[] = [
  { key: "workflows", label: "워크플로우", num: "1" },
  { key: "collections", label: "컬렉션", num: "2" },
  { key: "nodes", label: "노드", num: "3" },
  { key: "prompts", label: "프롬프트", num: "4" },
  { key: "tools", label: "도구", num: "5" },
  { key: "mcp", label: "MCP", num: "6" },
];

// ── ANSI ──
const CSI = "\x1b[";
const clear = () => process.stdout.write(`${CSI}2J${CSI}H`);
const moveTo = (r: number, c: number) => process.stdout.write(`${CSI}${r};${c}H`);
const dim = (s: string) => `${CSI}2m${s}${CSI}0m`;
const bold = (s: string) => `${CSI}1m${s}${CSI}0m`;
const inverse = (s: string) => `${CSI}7m${s}${CSI}0m`;
const red = (s: string) => `${CSI}31m${s}${CSI}0m`;
const green = (s: string) => `${CSI}32m${s}${CSI}0m`;
const yellow = (s: string) => `${CSI}33m${s}${CSI}0m`;
const cyan = (s: string) => `${CSI}36m${s}${CSI}0m`;
const hideCursor = () => process.stdout.write(`${CSI}?25l`);
const showCursor = () => process.stdout.write(`${CSI}?25h`);
function visualLen(s: string): number { return s.replace(/\x1b\[[0-9;]*m/g, "").length; }
function padV(s: string, w: number): string { return s + " ".repeat(Math.max(0, w - visualLen(s))); }

function withTimeout<T>(p: Promise<T>, ms = 3000, label = ""): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`${label} 타임아웃`)), ms);
    p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); });
  });
}

export async function startRawTui(): Promise<void> {
  const provider = getDefaultProvider();
  const server = getServer();
  const auth = getAuth();
  const sv = auth && server ? `${auth.username}@${server.replace(/https?:\/\//, "")}` : "미연결";

  let tab: Tab = "workflows";
  let sel = 0;
  let inputBuf = "";
  let inputActive = false;

  // ── 데이터 ──
  let workflows: { name: string; id: string; deployed: boolean }[] = [];
  let collections: { name: string; id: string | number; docs: number; chunks: number }[] = [];
  let nodes: { name: string; desc: string; id?: string; category?: string }[] = [];
  let prompts: { name: string; type: string; uid?: string; content?: string; dbId?: number }[] = [];
  let tools: { name: string; desc: string; id?: number; fid?: string; url?: string; status?: string }[] = [];
  let mcpSessions: { id: string; name: string; type: string; status: string }[] = [];

  // 오른쪽 상단: 샌드박스 (상세/테스트 결과)
  let sandbox: string[] = ["← 항목 선택"];
  // 하단: 채팅 히스토리
  let chatLines: string[] = [dim("채팅: 질문을 입력하세요 (선택한 워크플로우로 실행)")];
  let statusMsg = "로딩...";

  // ── 데이터 로드 ──
  async function loadData() {
    statusMsg = "로딩 중..."; render();
    if (!server || !auth) {
      statusMsg = "서버 미연결";
      sandbox = [red("서버 미연결"), "", cyan("  xgen config set-server <URL>"), cyan("  xgen login")];
      render(); return;
    }
    const errors: string[] = [];
    try {
      const [wf, doc, ex] = await Promise.all([
        import("../api/workflow.js"), import("../api/document.js"), import("../api/xgen-extra.js"),
      ]);
      const r = await Promise.allSettled([
        withTimeout(wf.getWorkflowListDetail(), 3000, "워크플로우"),
        withTimeout(doc.listCollections(), 3000, "컬렉션"),
        withTimeout(ex.listNodes(), 3000, "노드"),
        withTimeout(ex.listPrompts(), 3000, "프롬프트"),
        withTimeout(ex.listToolStore(), 3000, "도구"),
        withTimeout(ex.listMcpSessions(), 3000, "MCP").catch(() => []),
      ]);

      if (r[0].status === "fulfilled") workflows = (r[0].value as any[]).map((w: any) => ({
        name: w.workflow_name ?? w.name ?? "?", id: w.workflow_id ?? w.id ?? "",
        deployed: w.deploy_status === "deployed" || w.deploy_status === "DEPLOYED" || !!w.is_deployed,
      })); else errors.push(`워크플로우: ${(r[0] as any).reason?.message ?? "실패"}`);

      if (r[1].status === "fulfilled") collections = (r[1].value as any[]).map((c: any) => ({
        name: c.collection_make_name ?? c.collection_name ?? "?",
        id: c.id ?? c.collection_id ?? "", docs: c.total_documents ?? 0, chunks: c.total_chunks ?? 0,
      })); else errors.push(`컬렉션: ${(r[1] as any).reason?.message ?? "실패"}`);

      if (r[2].status === "fulfilled") {
        nodes = [];
        for (const cat of (r[2].value as any[])) {
          const catName = cat.categoryName ?? "";
          for (const fn of (cat.functions ?? [])) {
            for (const n of (fn.nodes ?? [])) {
              nodes.push({ name: n.nodeName ?? n.name ?? "?", desc: (n.description ?? "").slice(0, 40), id: n.id, category: `${catName}/${fn.functionName ?? ""}` });
            }
          }
        }
      } else errors.push(`노드: ${(r[2] as any).reason?.message ?? "실패"}`);

      if (r[3].status === "fulfilled") prompts = (r[3].value as any[]).map((p: any) => ({
        name: p.prompt_title ?? p.name ?? "?", type: p.prompt_type ?? "", uid: p.prompt_uid, content: p.prompt_content, dbId: p.id,
      })); else errors.push(`프롬프트: ${(r[3] as any).reason?.message ?? "실패"}`);

      if (r[4].status === "fulfilled") tools = (r[4].value as any[]).map((t: any) => {
        const fd = t.function_data ?? {};
        return { name: fd.function_name ?? t.function_name ?? "?", desc: (fd.description ?? t.description ?? "").slice(0, 40),
          id: t.id, fid: fd.function_id ?? t.function_upload_id, url: fd.api_url, status: fd.status ?? t.status };
      }); else errors.push(`도구: ${(r[4] as any).reason?.message ?? "실패"}`);

      if (r[5].status === "fulfilled" && Array.isArray(r[5].value)) mcpSessions = (r[5].value as any[]).map((s: any) => ({
        id: s.session_id ?? "", name: s.session_name ?? "?", type: s.server_type ?? "?", status: s.status ?? "?",
      }));
    } catch (e: any) { errors.push(e.message); }

    sel = 0; updateSandbox();
    statusMsg = errors.length > 0 ? `⚠ ${errors.length}개 오류 │ r 재시도` : getHint();
    if (errors.length > 0) sandbox = [red("오류:"), ...errors.map(e => yellow(`  • ${e}`))];
    render();
  }

  function getHint(): string {
    const h: Record<Tab, string> = {
      workflows: "↑↓ 이동 │ Enter 구조 │ 질문 입력→실행 │ 1-6 탭 │ r │ q",
      collections: "↑↓ │ Enter 문서 │ 1-6 탭 │ q",
      nodes: "↑↓ │ Enter 상세 │ 1-6 탭 │ q",
      prompts: "↑↓ │ Enter 내용 │ c생성 e수정 d삭제 │ q",
      tools: "↑↓ │ Enter 테스트 │ c생성 u스토어 │ q",
      mcp: "↑↓ │ Enter 도구 │ c생성 t호출 d삭제 │ q",
    };
    return h[tab];
  }

  // ── 리스트 ──
  function getItems(): ListItem[] {
    switch (tab) {
      case "workflows": return workflows.map(w => ({ label: `${w.deployed ? green("●") : dim("○")} ${w.name}`, sub: w.id.slice(0, 12) }));
      case "collections": return collections.map(c => ({ label: c.name, sub: `${c.docs}문서` }));
      case "nodes": return nodes.map(n => ({ label: n.name, sub: n.category }));
      case "prompts": return prompts.map(p => ({ label: p.name, sub: `[${p.type}]` }));
      case "tools": return tools.map(t => ({ label: `${t.status === "active" ? green("●") : dim("○")} ${t.name}`, sub: t.desc }));
      case "mcp": return mcpSessions.map(s => ({ label: `${s.status === "running" ? green("●") : dim("○")} ${s.name}`, sub: s.type }));
    }
  }

  // ── 샌드박스 (오른쪽 상단) ──
  function updateSandbox() {
    const items = getItems();
    if (items.length === 0) { sandbox = [dim("데이터 없음")]; return; }
    if (sel < 0) sel = 0;
    if (sel >= items.length) sel = items.length - 1;

    if (tab === "workflows" && workflows[sel]) {
      const w = workflows[sel];
      sandbox = [bold(w.name), `ID: ${w.id}`, `배포: ${w.deployed ? green("Yes") : red("No")}`, "",
        cyan("Enter") + " 노드구조", dim("질문 입력 → 워크플로우 실행")];
    } else if (tab === "collections" && collections[sel]) {
      const c = collections[sel];
      sandbox = [bold(c.name), `문서 ${c.docs}개 │ 청크 ${c.chunks}개`, "", cyan("Enter") + " 문서 목록"];
    } else if (tab === "nodes" && nodes[sel]) {
      const n = nodes[sel];
      sandbox = [bold(n.name), `카테고리: ${n.category ?? "?"}`, n.desc, "", cyan("Enter") + " 파라미터 상세"];
    } else if (tab === "prompts" && prompts[sel]) {
      const p = prompts[sel];
      sandbox = [bold(p.name), `타입: ${p.type}`, "", ...(p.content?.split("\n").slice(0, 8) ?? [dim("내용 없음")])];
    } else if (tab === "tools" && tools[sel]) {
      const t = tools[sel];
      sandbox = [bold(t.name), `URL: ${t.url ?? dim("없음")}`, `상태: ${t.status ?? "?"}`, "", cyan("Enter") + " API 테스트"];
    } else if (tab === "mcp" && mcpSessions[sel]) {
      const s = mcpSessions[sel];
      sandbox = [bold(s.name), `세션: ${s.id}`, `타입: ${s.type}`, `상태: ${s.status}`, "", cyan("Enter") + " 도구 목록"];
    }
  }

  // ── 렌더 — 3분할 ──
  function render() {
    const cols = process.stdout.columns || 120;
    const rows = process.stdout.rows || 30;
    const leftW = Math.floor(cols * 0.35);
    const rightW = cols - leftW - 1;
    const topH = Math.floor((rows - 4) * 0.55);  // 상단 영역 높이
    const botH = rows - 4 - topH;                  // 하단 채팅 높이
    clear();

    // ── 헤더 ──
    moveTo(1, 1);
    const tabStr = TABS.map(t => (tab === t.key ? inverse(` ${t.num}:${t.label} `) : dim(` ${t.num}:${t.label} `))).join("");
    process.stdout.write(` ${bold(cyan("OPEN XGEN"))} ${dim("v3")} ${dim(sv)} │ ${tabStr}`);

    // ── 상단 구분선 ──
    moveTo(2, 1);
    process.stdout.write(dim("─".repeat(leftW) + "┬" + "─".repeat(rightW)));

    // ── 상단: 왼쪽(목록) + 오른쪽(샌드박스) ──
    const items = getItems();
    const listH = topH;
    const scr = items.length <= listH ? 0 : Math.max(0, Math.min(sel - Math.floor(listH / 2), items.length - listH));

    for (let i = 0; i < listH; i++) {
      moveTo(3 + i, 1);
      const idx = scr + i;
      let left: string;
      if (idx < items.length) {
        const item = items[idx];
        const sub = item.sub ? dim(` ${item.sub}`) : "";
        left = padV(`${idx === sel ? "▸" : " "} ${String(idx + 1).padStart(2)}. ${item.label}${sub}`, leftW);
        if (idx === sel) left = inverse(left);
      } else { left = " ".repeat(leftW); }
      process.stdout.write(left);
      process.stdout.write(dim("│"));
      // 샌드박스
      if (i < sandbox.length) process.stdout.write(` ${sandbox[i]}`);
    }

    // ── 중간 구분선 (상단↔하단) ──
    moveTo(3 + topH, 1);
    process.stdout.write(dim("─".repeat(leftW) + "┴" + "─".repeat(rightW)));

    // ── 하단: 채팅 + 결과 (전체 폭) ──
    const chatStart = 4 + topH;
    const chatDisplayH = botH - 2; // 입력바 + 상태바 제외
    const chatOffset = Math.max(0, chatLines.length - chatDisplayH);
    for (let i = 0; i < chatDisplayH; i++) {
      moveTo(chatStart + i, 1);
      const lineIdx = chatOffset + i;
      if (lineIdx < chatLines.length) {
        process.stdout.write(` ${chatLines[lineIdx]}`.slice(0, cols));
      }
    }

    // ── 입력 바 ──
    moveTo(rows - 1, 1);
    if (inputActive) {
      const ctx = tab === "workflows" && workflows[sel] ? `${workflows[sel].name} ` : "";
      process.stdout.write(` ${cyan(ctx + "❯")} ${inputBuf}`);
      showCursor();
    } else {
      process.stdout.write(dim(` ${getHint()}`));
      hideCursor();
    }

    // ── 상태 바 ──
    moveTo(rows, 1);
    process.stdout.write(dim(` ${statusMsg}`.slice(0, cols)));
  }

  // ── 액션 ──
  function addChat(line: string) {
    chatLines.push(line);
    if (chatLines.length > 200) chatLines = chatLines.slice(-100);
  }

  async function runWorkflow(wf: { name: string; id: string }, input: string) {
    addChat(`${cyan("❯")} ${input}`);
    addChat(yellow(`  ${wf.name} 실행 중...`));
    sandbox = [bold(wf.name), "", yellow("실행 중...")];
    render();
    try {
      const { executeWorkflow } = await import("../api/workflow.js");
      const { randomUUID } = await import("node:crypto");
      const r = await withTimeout(executeWorkflow({
        workflow_id: wf.id, workflow_name: wf.name, input_data: input,
        interaction_id: `tui_${randomUUID().slice(0, 8)}`,
        user_id: auth?.userId ? parseInt(auth.userId) : 1,
      }), 30000, "실행") as any;
      const content = String(r?.content ?? r?.message ?? r?.result ?? JSON.stringify(r).slice(0, 500));
      const lines = content.split("\n");
      addChat(green("  결과:"));
      for (const l of lines.slice(0, 20)) addChat(`  ${l}`);
      addChat("");
      sandbox = [bold(wf.name), "", green("완료"), "", ...lines.slice(0, 10)];
    } catch (err: any) {
      addChat(red(`  실패: ${err.message}`));
      sandbox = [bold(wf.name), "", red(`실패: ${err.message}`)];
    }
    statusMsg = getHint(); render();
  }

  async function loadWorkflowStructure(wf: { name: string; id: string }) {
    sandbox = [bold(wf.name), "", yellow("노드/엣지 로딩...")]; render();
    try {
      const { getWorkflowDetail } = await import("../api/workflow.js");
      const data = await withTimeout(getWorkflowDetail(wf.id), 8000, "로드") as any;
      const wd = data?.workflow_data ?? data;
      const ns = wd?.nodes ?? data?.nodes ?? [];
      const es = wd?.edges ?? data?.edges ?? [];
      sandbox = [bold(wf.name), `노드 ${ns.length}개  엣지 ${es.length}개`, "",
        ...ns.slice(0, 12).map((n: any, i: number) => `  ${i + 1}. ${n.data?.label ?? n.data?.nodeName ?? n.type ?? "?"} ${dim(n.data?.nodeId ?? "")}`),
        ...(ns.length > 12 ? [dim(`  +${ns.length - 12}개`)] : []),
        "", bold("연결:"),
        ...es.slice(0, 6).map((e: any) => {
          const s = ns.find((n: any) => n.id === e.source);
          const t = ns.find((n: any) => n.id === e.target);
          return `  ${s?.data?.label ?? "?"} → ${t?.data?.label ?? "?"}`;
        }),
      ];
    } catch (err: any) { sandbox = [bold(wf.name), "", red(err.message)]; }
    render();
  }

  async function loadNodeDetail(n: { name: string; id?: string }) {
    if (!n.id) { sandbox = [red("노드 ID 없음")]; render(); return; }
    sandbox = [bold(n.name), yellow("로딩...")]; render();
    try {
      const { getNodeDetail } = await import("../api/xgen-extra.js");
      const d = await withTimeout(getNodeDetail(n.id), 5000, "노드") as any;
      const ins = d?.inputs ?? d?.inputPorts ?? [];
      const outs = d?.outputs ?? d?.outputPorts ?? [];
      const params = d?.parameters ?? d?.defaultParams ?? {};
      const pkeys = typeof params === "object" ? Object.keys(params) : [];
      sandbox = [bold(d?.nodeName ?? n.name), `ID: ${d?.nodeId ?? n.id}`, `카테고리: ${d?.category ?? "?"}`, "",
        bold(`입력(${ins.length}):`), ...ins.slice(0, 4).map((p: any) => `  ${p.name ?? "?"} ${dim(p.type ?? "")}`),
        bold(`출력(${outs.length}):`), ...outs.slice(0, 4).map((p: any) => `  ${p.name ?? "?"} ${dim(p.type ?? "")}`),
        bold(`파라미터(${pkeys.length}):`), ...pkeys.slice(0, 6).map(k => `  ${k}: ${dim(String(params[k]).slice(0, 25))}`)];
    } catch (err: any) { sandbox = [red(err.message)]; }
    render();
  }

  async function testTool(t: { name: string; url?: string }) {
    if (!t.url) { sandbox = [red("URL 없음")]; render(); return; }
    sandbox = [bold(t.name), yellow(`테스트: ${t.url}`)]; addChat(yellow(`  도구 테스트: ${t.name}`)); render();
    try {
      const { apiTest } = await import("../api/xgen-extra.js");
      const r = await withTimeout(apiTest({ api_url: t.url, api_method: "GET", api_timeout: 10 }), 15000, "테스트") as any;
      const ok = r?.success ?? (r?.data?.status && r.data.status < 400);
      const st = r?.data?.status ?? "?";
      const resp = r?.data?.response;
      const lines = (typeof resp === "string" ? resp : JSON.stringify(resp ?? {}, null, 2)).split("\n").slice(0, 10);
      sandbox = [bold(t.name), ok ? green(`✓ ${st} OK`) : red(`✗ ${st} FAIL`), "", ...lines];
      addChat(ok ? green(`  ✓ ${t.name} ${st} OK`) : red(`  ✗ ${t.name} ${st} FAIL`));
    } catch (err: any) { sandbox = [red(err.message)]; addChat(red(`  실패: ${err.message}`)); }
    render();
  }

  // ── 키 핸들러 ──
  function handleKey(s: string) {
    // 입력 모드
    if (inputActive) {
      if (s === "\x1b") { inputActive = false; inputBuf = ""; render(); return; }
      if (s === "\r" || s === "\n") {
        const val = inputBuf.trim(); inputActive = false; inputBuf = "";
        if (val && tab === "workflows" && workflows[sel]) {
          runWorkflow(workflows[sel], val);
        } else if (val) {
          addChat(`${cyan("❯")} ${val}`);
          addChat(dim("  워크플로우를 선택한 후 질문을 입력하세요."));
          render();
        } else { render(); }
        return;
      }
      if (s === "\x7f" || s === "\b") { inputBuf = inputBuf.slice(0, -1); render(); return; }
      if (s === "\x03") { inputActive = false; inputBuf = ""; render(); return; }
      if (s.charCodeAt(0) >= 32) { inputBuf += s; render(); return; }
      return;
    }

    // 일반 모드
    if (s === "q" || s === "\x03") { cleanup(); process.exit(0); }
    if (s === "r" || s === "R") { loadData(); return; }

    // 아무 문자 입력 → 바로 입력 모드 활성화 (알파벳, 한글 등)
    if (s.length === 1 && s.charCodeAt(0) >= 32 && !/^[0-9cutedvq]$/i.test(s)) {
      inputActive = true; inputBuf = s; render(); return;
    }

    // 탭별 단축키
    if (/^[cC]$/.test(s)) {
      if (tab === "tools") { addChat(cyan("  도구 생성은 xgen agent에서: '새 도구 만들어줘'")); render(); return; }
      if (tab === "prompts") { addChat(cyan("  프롬프트 생성은 xgen agent에서: '프롬프트 만들어줘'")); render(); return; }
      if (tab === "mcp") { addChat(cyan("  MCP 세션 생성은 xgen agent에서: 'MCP 세션 만들어줘'")); render(); return; }
    }
    if (/^[tT]$/.test(s) && tab === "tools" && tools[sel]) { testTool(tools[sel]); return; }
    if (/^[dD]$/.test(s)) {
      if (tab === "prompts" && prompts[sel]?.uid) {
        sandbox = [yellow("삭제 중...")]; render();
        import("../api/xgen-extra.js").then(async m => {
          try { await m.deletePrompt(prompts[sel].uid!); sandbox = [green("삭제 완료")]; addChat(green("  프롬프트 삭제됨")); }
          catch (e: any) { sandbox = [red(e.message)]; }
          render();
        });
        return;
      }
      if (tab === "mcp" && mcpSessions[sel]) {
        const sid = mcpSessions[sel].id;
        sandbox = [yellow("삭제 중...")]; render();
        import("../api/xgen-extra.js").then(async m => {
          try { await m.deleteMcpSession(sid); sandbox = [green("삭제 완료")]; } catch (e: any) { sandbox = [red(e.message)]; }
          render();
        });
        return;
      }
    }
    if (/^[uU]$/.test(s) && tab === "tools" && tools[sel]?.fid) {
      sandbox = [yellow("스토어 등록 중...")]; render();
      import("../api/xgen-extra.js").then(async m => {
        try { await m.uploadToolToStore(tools[sel].fid!, tools[sel].desc); sandbox = [green("스토어 등록 완료")]; addChat(green("  스토어 등록됨")); }
        catch (e: any) { sandbox = [red(e.message)]; }
        render();
      });
      return;
    }

    // 탭 전환
    const n = parseInt(s);
    if (n >= 1 && n <= 6) { tab = TABS[n - 1].key; sel = 0; updateSandbox(); statusMsg = getHint(); render(); return; }
    if (s === "\t") { const i = TABS.findIndex(t => t.key === tab); tab = TABS[(i + 1) % TABS.length].key; sel = 0; updateSandbox(); statusMsg = getHint(); render(); return; }
    if (s === "\x1b[Z") { const i = TABS.findIndex(t => t.key === tab); tab = TABS[(i - 1 + TABS.length) % TABS.length].key; sel = 0; updateSandbox(); statusMsg = getHint(); render(); return; }

    // 방향키
    if (s === "\x1b[A") { const items = getItems(); if (items.length > 0) { sel = Math.max(0, sel - 1); updateSandbox(); render(); } return; }
    if (s === "\x1b[B") { const items = getItems(); if (items.length > 0) { sel = Math.min(items.length - 1, sel + 1); updateSandbox(); render(); } return; }
    if (s === "\x1b[5~") { sel = Math.max(0, sel - 10); updateSandbox(); render(); return; }
    if (s === "\x1b[6~") { const items = getItems(); sel = Math.min(items.length - 1, sel + 10); updateSandbox(); render(); return; }

    // Enter
    if (s === "\r" || s === "\n") {
      const items = getItems();
      if (items.length === 0) return;
      if (tab === "workflows" && workflows[sel]) loadWorkflowStructure(workflows[sel]);
      else if (tab === "collections" && collections[sel]) {
        sandbox = [bold(collections[sel].name), yellow("문서 로딩...")]; render();
        import("../api/document.js").then(async m => {
          try {
            const docs = await withTimeout(m.listDocuments(String(collections[sel].id)), 5000, "문서");
            sandbox = docs?.length ? [bold(collections[sel].name) + ` ${docs.length}개`, "", ...docs.map((d: any, i: number) => `  ${i + 1}. ${d.name || d.file_name || "?"}`).slice(0, 15)]
              : [bold(collections[sel].name), dim("문서 없음")];
          } catch (e: any) { sandbox = [red(e.message)]; }
          render();
        });
      }
      else if (tab === "nodes" && nodes[sel]) loadNodeDetail(nodes[sel]);
      else if (tab === "prompts" && prompts[sel]) {
        const p = prompts[sel];
        sandbox = [bold(p.name), `타입: ${p.type}`, `UID: ${p.uid ?? "?"}`, "", ...(p.content?.split("\n").slice(0, 15) ?? [dim("없음")])];
        render();
      }
      else if (tab === "tools" && tools[sel]) testTool(tools[sel]);
      else if (tab === "mcp" && mcpSessions[sel]) {
        sandbox = [bold(mcpSessions[sel].name), yellow("도구 로딩...")]; render();
        import("../api/xgen-extra.js").then(async m => {
          try {
            const ts = await withTimeout(m.getMcpSessionTools(mcpSessions[sel].id), 8000, "MCP") as any[];
            sandbox = ts?.length ? [bold(mcpSessions[sel].name) + ` ${ts.length}개 도구`, "", ...ts.map((t: any, i: number) => `  ${i + 1}. ${t.name ?? "?"} ${dim(t.description?.slice(0, 30) ?? "")}`).slice(0, 15)]
              : [bold(mcpSessions[sel].name), dim("도구 없음")];
          } catch (e: any) { sandbox = [red(e.message)]; }
          render();
        });
      }
      return;
    }
  }

  function cleanup() {
    showCursor(); clear();
    if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false);
    process.stdin.removeAllListeners("data"); process.stdin.pause();
  }

  // ── 시작 ──
  if (!process.stdin.isTTY) { console.error("터미널(TTY)에서만 실행 가능합니다."); return; }
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8"); hideCursor();
  process.stdin.on("data", (d: any) => { try { handleKey(String(d)); } catch (e: any) { statusMsg = red(e.message); render(); } });
  process.stdout.on("resize", () => render());
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("exit", () => { showCursor(); });
  loadData();
  await new Promise<void>(() => {});
}
