/**
 * OPEN XGEN Raw TUI Dashboard v2
 * 조회 + 샌드박스(생성/테스트/등록) + MCP + 노드상세 + 워크플로우 구조
 */
import { getServer, getAuth, getDefaultProvider } from "../config/store.js";

type Tab = "workflows" | "collections" | "nodes" | "prompts" | "tools" | "mcp";
interface ListItem { label: string; sub?: string; }
interface FormField { key: string; label: string; required?: boolean; default?: string; }
interface FormContext {
  type: string;
  fields: FormField[];
  step: number;
  values: Record<string, string>;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}

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

function withTimeout<T>(p: Promise<T>, ms = 5000, label = "API"): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} 타임아웃 (${ms}ms)`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

export async function startRawTui(): Promise<void> {
  const provider = getDefaultProvider();
  const server = getServer();
  const auth = getAuth();
  const serverDisplay = auth && server
    ? `${auth.username}@${server.replace(/https?:\/\//, "")}`
    : "미연결";

  let tab: Tab = "workflows";
  let selected = 0;
  let inputMode = false;
  let inputBuffer = "";
  let formCtx: FormContext | null = null;

  // ── 데이터 ──
  let workflows: { name: string; id: string; deployed: boolean }[] = [];
  let collections: { name: string; id: number | string; docs: number; chunks: number }[] = [];
  let nodes: { name: string; desc: string; id?: string; category?: string }[] = [];
  let prompts: { name: string; type: string; uid?: string; content?: string; dbId?: number }[] = [];
  let tools: { name: string; desc: string; id?: number; functionId?: string; apiUrl?: string; status?: string }[] = [];
  let mcpSessions: { id: string; name: string; type: string; status: string; command?: string }[] = [];
  let detail: string[] = ["← 항목을 선택하세요"];
  let statusMsg = "로딩...";
  let errors: string[] = [];

  // ── 데이터 로드 ──
  async function loadData() {
    statusMsg = "데이터 로딩 중..."; errors = []; render();
    if (!server || !auth) {
      statusMsg = "서버 미연결";
      detail = [red("서버 미연결"), "", cyan("  xgen config set-server <URL>"), cyan("  xgen login"), "", "후 r 새로고침"];
      render(); return;
    }
    try {
      const [wfMod, docMod, extraMod] = await Promise.all([
        import("../api/workflow.js"), import("../api/document.js"), import("../api/xgen-extra.js"),
      ]);
      const results = await Promise.allSettled([
        withTimeout(wfMod.getWorkflowListDetail(), 3000, "워크플로우"),
        withTimeout(docMod.listCollections(), 3000, "컬렉션"),
        withTimeout(extraMod.listNodes(), 3000, "노드"),
        withTimeout(extraMod.listPrompts(), 3000, "프롬프트"),
        withTimeout(extraMod.listToolStore(), 3000, "도구"),
        withTimeout(extraMod.listMcpSessions(), 3000, "MCP").catch(() => []),
      ]);
      const [wfR, colR, nodeR, promptR, toolR, mcpR] = results;

      if (wfR.status === "fulfilled") {
        workflows = (wfR.value as any[]).map((w: any) => ({
          name: w.workflow_name ?? w.name ?? "?", id: w.workflow_id ?? w.id ?? "",
          deployed: w.deploy_status === "deployed" || w.deploy_status === "DEPLOYED" || !!w.is_deployed,
        }));
      } else errors.push(`워크플로우: ${(wfR as PromiseRejectedResult).reason?.message ?? "실패"}`);

      if (colR.status === "fulfilled") {
        collections = (colR.value as any[]).map((c: any) => ({
          name: c.collection_make_name ?? c.collection_name ?? c.name ?? "?",
          id: c.id ?? c.collection_id ?? "", docs: c.total_documents ?? 0, chunks: c.total_chunks ?? 0,
        }));
      } else errors.push(`컬렉션: ${(colR as PromiseRejectedResult).reason?.message ?? "실패"}`);

      if (nodeR.status === "fulfilled") {
        // 노드 API는 카테고리 > 함수 > 노드 중첩 구조
        nodes = [];
        const raw = nodeR.value as any[];
        for (const cat of raw) {
          const catName = cat.categoryName ?? cat.categoryId ?? "";
          const fns = cat.functions ?? cat.nodes ?? [];
          if (Array.isArray(fns)) {
            for (const fn of fns) {
              const fnNodes = fn.nodes ?? [];
              if (Array.isArray(fnNodes)) {
                for (const n of fnNodes) {
                  nodes.push({
                    name: n.nodeName ?? n.name ?? "?",
                    desc: (n.description ?? "").slice(0, 50),
                    id: n.id ?? n.nodeId,
                    category: `${catName}/${fn.functionName ?? fn.functionId ?? ""}`,
                  });
                }
              } else {
                // fn 자체가 노드인 경우
                nodes.push({
                  name: fn.nodeName ?? fn.name ?? "?",
                  desc: (fn.description ?? "").slice(0, 50),
                  id: fn.id ?? fn.nodeId,
                  category: catName,
                });
              }
            }
          }
        }
      } else errors.push(`노드: ${(nodeR as PromiseRejectedResult).reason?.message ?? "실패"}`);

      if (promptR.status === "fulfilled") {
        prompts = (promptR.value as any[]).map((p: any) => ({
          name: p.prompt_title ?? p.name ?? p.title ?? "?", type: p.prompt_type ?? p.type ?? "",
          uid: p.prompt_uid ?? p.uid, content: p.prompt_content ?? p.content, dbId: p.id,
        }));
      } else errors.push(`프롬프트: ${(promptR as PromiseRejectedResult).reason?.message ?? "실패"}`);

      if (toolR.status === "fulfilled") {
        tools = (toolR.value as any[]).map((t: any) => {
          const fd = t.function_data ?? {};
          return {
            name: fd.function_name ?? t.function_name ?? t.name ?? t.tool_name ?? "?",
            desc: (fd.description ?? t.description ?? "").slice(0, 50),
            id: t.id, functionId: fd.function_id ?? t.function_id ?? t.function_upload_id,
            apiUrl: fd.api_url ?? t.api_url, status: fd.status ?? t.status,
          };
        });
      } else errors.push(`도구: ${(toolR as PromiseRejectedResult).reason?.message ?? "실패"}`);

      if (mcpR.status === "fulfilled" && Array.isArray(mcpR.value)) {
        mcpSessions = (mcpR.value as any[]).map((s: any) => ({
          id: s.session_id ?? s.id ?? "", name: s.session_name ?? s.name ?? "이름없음",
          type: s.server_type ?? "?", status: s.status ?? "unknown", command: s.server_command,
        }));
      }
    } catch (err: any) { errors.push(`전체: ${err.message}`); }

    selected = 0; updateDetail();
    statusMsg = errors.length > 0
      ? `⚠ ${errors.length}개 오류 │ r 재시도`
      : getHint();
    if (errors.length > 0) detail = [red("로드 오류:"), "", ...errors.map(e => yellow(`  • ${e}`))];
    render();
  }

  function getHint(): string {
    const hints: Record<Tab, string> = {
      workflows: "↑↓ │ Enter 노드구조/실행 │ 1-6 탭 │ r │ q",
      collections: "↑↓ │ Enter 문서목록 │ 1-6 탭 │ r │ q",
      nodes: "↑↓ │ Enter 상세(파라미터) │ 1-6 탭 │ r │ q",
      prompts: "↑↓ │ Enter 내용 │ c생성 e수정 d삭제 u스토어 v버전 │ q",
      tools: "↑↓ │ Enter/t 테스트 │ c생성 u스토어등록 │ q",
      mcp: "↑↓ │ Enter 도구목록 │ c세션생성 t도구호출 d삭제 │ q",
    };
    return hints[tab];
  }

  // ── 리스트 ──
  function getItems(): ListItem[] {
    switch (tab) {
      case "workflows": return workflows.map(w => ({ label: `${w.deployed ? green("●") : dim("○")} ${w.name}`, sub: w.id.slice(0, 16) }));
      case "collections": return collections.map(c => ({ label: c.name, sub: `${c.docs}문서 ${c.chunks}청크` }));
      case "nodes": return nodes.map(n => ({ label: n.name, sub: n.category ? `[${n.category}] ${n.desc}` : n.desc }));
      case "prompts": return prompts.map(p => ({ label: p.name, sub: `[${p.type}]` }));
      case "tools": return tools.map(t => {
        const st = t.status === "active" ? green("●") : t.status === "inactive" ? red("●") : dim("○");
        return { label: `${st} ${t.name}`, sub: t.desc };
      });
      case "mcp": return mcpSessions.map(s => {
        const st = s.status === "running" ? green("●") : s.status === "error" ? red("●") : dim("○");
        return { label: `${st} ${s.name}`, sub: `[${s.type}] ${s.status}` };
      });
    }
  }

  // ── 디테일 ──
  function updateDetail() {
    const items = getItems();
    if (items.length === 0) {
      const createHint = tab === "tools" ? "c 도구 생성" : tab === "prompts" ? "c 프롬프트 생성" : tab === "mcp" ? "c MCP 세션 생성" : "";
      detail = [dim("데이터 없음"), "", dim(createHint)]; return;
    }
    if (selected < 0) selected = 0;
    if (selected >= items.length) selected = items.length - 1;

    if (tab === "workflows" && workflows[selected]) {
      const w = workflows[selected];
      detail = [bold(w.name), "", `ID   ${w.id || dim("없음")}`, `배포 ${w.deployed ? green("● Yes") : red("○ No")}`, "",
        cyan("Enter") + " 노드/엣지 구조 보기", cyan("i") + "     질문 입력 후 실행"];
    } else if (tab === "collections" && collections[selected]) {
      const c = collections[selected];
      detail = [bold(c.name), "", `문서 ${c.docs}개`, `청크 ${c.chunks}개`, "", cyan("Enter") + " 문서 목록"];
    } else if (tab === "nodes" && nodes[selected]) {
      const n = nodes[selected];
      detail = [bold(n.name), "", `카테고리: ${n.category || dim("없음")}`, n.desc || dim("설명 없음"), "",
        cyan("Enter") + " 파라미터/포트 상세"];
    } else if (tab === "prompts" && prompts[selected]) {
      const p = prompts[selected];
      const preview = p.content ? p.content.split("\n").slice(0, 8) : [dim("내용 없음")];
      detail = [bold(p.name), `타입: ${p.type || "없음"}`, `UID: ${p.uid || dim("없음")}`, "", ...preview, "",
        `${cyan("c")}생성 ${cyan("e")}수정 ${cyan("d")}삭제 ${cyan("u")}스토어 ${cyan("v")}버전`];
    } else if (tab === "tools" && tools[selected]) {
      const t = tools[selected];
      detail = [bold(t.name), "", `ID     ${t.functionId || dim("없음")}`, `URL    ${t.apiUrl || dim("없음")}`,
        `상태   ${t.status === "active" ? green("active") : t.status === "inactive" ? red("inactive") : dim(t.status || "없음")}`,
        "", t.desc || dim("설명 없음"), "",
        `${cyan("t")}테스트 ${cyan("u")}스토어등록 ${cyan("c")}생성`];
    } else if (tab === "mcp" && mcpSessions[selected]) {
      const s = mcpSessions[selected];
      detail = [bold(s.name), "", `세션ID  ${s.id}`, `타입    ${s.type}`, `상태    ${s.status === "running" ? green(s.status) : red(s.status)}`,
        `커맨드  ${s.command || dim("없음")}`, "",
        `${cyan("Enter")}도구목록 ${cyan("t")}도구호출 ${cyan("d")}삭제`];
    }
  }

  // ── 렌더 ──
  function visualLen(s: string): number { return s.replace(/\x1b\[[0-9;]*m/g, "").length; }
  function padVisual(s: string, w: number): string { return s + " ".repeat(Math.max(0, w - visualLen(s))); }

  function render() {
    const cols = process.stdout.columns || 120;
    const rows = process.stdout.rows || 30;
    const leftW = Math.floor(cols * 0.5);
    const rightW = cols - leftW - 1;
    const listH = rows - 5;
    clear();

    moveTo(1, 1);
    const tabStr = TABS.map(t => (tab === t.key ? inverse(` ${t.num}:${t.label} `) : dim(` ${t.num}:${t.label} `))).join("");
    process.stdout.write(` ${bold(cyan("OPEN XGEN"))} ${dim("v2.4")} ${dim(serverDisplay)} │ ${tabStr}`);

    moveTo(2, 1);
    process.stdout.write(dim("─".repeat(leftW) + "┬" + "─".repeat(rightW)));

    const items = getItems();
    const vis = Math.max(1, listH);
    const scr = items.length <= vis ? 0 : Math.max(0, Math.min(selected - Math.floor(vis / 2), items.length - vis));

    for (let i = 0; i < vis; i++) {
      moveTo(3 + i, 1);
      const idx = scr + i;
      let left: string;
      if (idx < items.length) {
        const item = items[idx];
        const sub = item.sub ? dim(` ${item.sub}`) : "";
        left = padVisual(`${idx === selected ? "▸" : " "} ${String(idx + 1).padStart(2)}. ${item.label}${sub}`, leftW);
        if (idx === selected) left = inverse(left);
      } else { left = " ".repeat(leftW); }
      process.stdout.write(left);
      process.stdout.write(dim("│"));
      if (i < detail.length) process.stdout.write(` ${detail[i]}`);
    }
    if (items.length === 0) { moveTo(4, 3); process.stdout.write(dim("(항목 없음)")); }

    moveTo(rows - 2, 1);
    process.stdout.write(dim("─".repeat(leftW) + "┴" + "─".repeat(rightW)));

    moveTo(rows - 1, 1);
    if (inputMode || formCtx) {
      const pr = formCtx ? `${formCtx.fields[formCtx.step].label}${formCtx.fields[formCtx.step].required ? "*" : ""} ❯ ` : "❯ ";
      process.stdout.write(` ${cyan(pr)}${inputBuffer}`);
      showCursor();
    } else { process.stdout.write(dim(` ${getHint()}`)); hideCursor(); }

    moveTo(rows, 1);
    process.stdout.write(dim(` ${statusMsg}`.slice(0, cols)));
  }

  // ── 액션: 워크플로우 ──
  async function runWorkflow(wf: { name: string; id: string }, input: string) {
    detail = [bold(wf.name), "", `입력: ${input}`, "", yellow("실행 중...")]; render();
    try {
      const { executeWorkflow } = await import("../api/workflow.js");
      const { randomUUID } = await import("node:crypto");
      const r = await withTimeout(executeWorkflow({
        workflow_id: wf.id, workflow_name: wf.name, input_data: input,
        interaction_id: `tui_${randomUUID().slice(0, 8)}`,
        user_id: auth?.userId ? parseInt(auth.userId) : 1,
      }), 30000, "실행") as any;
      const content = r?.content ?? r?.message ?? r?.result ?? JSON.stringify(r).slice(0, 500);
      detail = [bold(wf.name), "", `입력: ${input}`, "", green("결과:"), ...String(content).split("\n").slice(0, 15)];
    } catch (err: any) { detail = [bold(wf.name), "", red(`실패: ${err.message}`)]; }
    statusMsg = getHint(); render();
  }

  async function loadWorkflowStructure(wf: { name: string; id: string }) {
    detail = [bold(wf.name), "", yellow("노드/엣지 로딩...")]; render();
    try {
      const { getWorkflowDetail } = await import("../api/workflow.js");
      const data = await withTimeout(getWorkflowDetail(wf.id), 10000, "워크플로우 로드") as any;
      const wfData = data?.workflow_data ?? data;
      const ns = wfData?.nodes ?? data?.nodes ?? [];
      const es = wfData?.edges ?? data?.edges ?? [];
      detail = [
        bold(wf.name), "",
        `노드 ${ns.length}개  엣지 ${es.length}개`, "",
        bold("노드:"),
        ...ns.slice(0, 15).map((n: any, i: number) => {
          const label = n.data?.label ?? n.data?.nodeName ?? n.type ?? "?";
          const nodeType = n.data?.nodeId ?? n.type ?? "";
          return `  ${i + 1}. ${label} ${dim(nodeType)}`;
        }),
        ...(ns.length > 15 ? [dim(`  ... +${ns.length - 15}개`)] : []),
        "",
        bold("연결:"),
        ...es.slice(0, 8).map((e: any) => {
          const src = ns.find((n: any) => n.id === e.source);
          const tgt = ns.find((n: any) => n.id === e.target);
          const srcName = src?.data?.label ?? src?.data?.nodeName ?? e.source;
          const tgtName = tgt?.data?.label ?? tgt?.data?.nodeName ?? e.target;
          return `  ${srcName} → ${tgtName}`;
        }),
        ...(es.length > 8 ? [dim(`  ... +${es.length - 8}개`)] : []),
        "",
        cyan("i") + " 질문 입력 후 실행",
      ];
    } catch (err: any) { detail = [bold(wf.name), "", red(`로드 실패: ${err.message}`)]; }
    render();
  }

  // ── 액션: 노드 ──
  async function loadNodeDetail(n: { name: string; id?: string }) {
    if (!n.id) { detail = [bold(n.name), "", red("노드 ID 없음")]; render(); return; }
    detail = [bold(n.name), "", yellow("상세 로딩...")]; render();
    try {
      const { getNodeDetail } = await import("../api/xgen-extra.js");
      const d = await withTimeout(getNodeDetail(n.id), 8000, "노드 상세") as any;
      const inputs = d?.inputs ?? d?.inputPorts ?? [];
      const outputs = d?.outputs ?? d?.outputPorts ?? [];
      const params = d?.parameters ?? d?.params ?? d?.defaultParams ?? {};
      const paramKeys = typeof params === "object" ? Object.keys(params) : [];
      detail = [
        bold(d?.nodeName ?? d?.name ?? n.name), "",
        `ID       ${d?.nodeId ?? d?.id ?? n.id}`,
        `카테고리 ${d?.category ?? d?.nodeCategory ?? dim("없음")}`,
        `설명     ${d?.description ?? dim("없음")}`,
        "",
        bold(`입력 포트 (${inputs.length}):`),
        ...inputs.slice(0, 5).map((p: any) => `  • ${p.name ?? p.id ?? "?"} ${dim(p.type ?? "")}`),
        "",
        bold(`출력 포트 (${outputs.length}):`),
        ...outputs.slice(0, 5).map((p: any) => `  • ${p.name ?? p.id ?? "?"} ${dim(p.type ?? "")}`),
        "",
        bold(`파라미터 (${paramKeys.length}):`),
        ...paramKeys.slice(0, 8).map(k => `  • ${k}: ${dim(String(params[k]).slice(0, 30))}`),
      ];
    } catch (err: any) { detail = [bold(n.name), "", red(`실패: ${err.message}`)]; }
    render();
  }

  // ── 액션: 프롬프트 ──
  function startCreatePrompt() {
    startForm("create-prompt", "새 프롬프트 생성", [
      { key: "prompt_title", label: "제목", required: true },
      { key: "prompt_content", label: "내용", required: true },
      { key: "prompt_type", label: "타입 (user/system)", default: "user" },
      { key: "language", label: "언어 (ko/en)", default: "ko" },
    ], async (v) => {
      detail = [bold("프롬프트 생성"), "", yellow("저장 중...")]; render();
      try {
        const { createPrompt } = await import("../api/xgen-extra.js");
        await withTimeout(createPrompt({ prompt_title: v.prompt_title, prompt_content: v.prompt_content, prompt_type: v.prompt_type || "user", language: v.language || "ko" }), 10000, "저장");
        detail = [bold("프롬프트 생성"), "", green("✓ 저장 완료!"), "", "r 새로고침"];
        statusMsg = green("저장 완료");
      } catch (err: any) { detail = [red(`✗ 실패: ${err.message}`)]; statusMsg = red("실패"); }
      render();
    });
  }

  function startEditPrompt() {
    if (!prompts[selected]) return;
    const p = prompts[selected];
    if (!p.uid) { detail = [red("UID 없음 — 수정 불가")]; render(); return; }
    startForm("edit-prompt", `프롬프트 수정: ${p.name}`, [
      { key: "prompt_title", label: "제목", default: p.name },
      { key: "prompt_content", label: "내용", default: p.content || "" },
      { key: "prompt_type", label: "타입", default: p.type || "user" },
    ], async (v) => {
      detail = [yellow("수정 중...")]; render();
      try {
        const { updatePrompt } = await import("../api/xgen-extra.js");
        await withTimeout(updatePrompt({ prompt_uid: p.uid!, prompt_title: v.prompt_title, prompt_content: v.prompt_content, prompt_type: v.prompt_type }), 10000, "수정");
        detail = [green("✓ 수정 완료!"), "", "r 새로고침"]; statusMsg = green("수정 완료");
      } catch (err: any) { detail = [red(`✗ 실패: ${err.message}`)]; statusMsg = red("실패"); }
      render();
    });
  }

  async function deleteSelectedPrompt() {
    if (!prompts[selected]?.uid) { detail = [red("UID 없음")]; render(); return; }
    const p = prompts[selected];
    detail = [bold(p.name), "", yellow("삭제 중...")]; render();
    try {
      const { deletePrompt } = await import("../api/xgen-extra.js");
      await withTimeout(deletePrompt(p.uid!), 10000, "삭제");
      detail = [green("✓ 삭제 완료!"), "", "r 새로고침"]; statusMsg = green("삭제 완료");
    } catch (err: any) { detail = [red(`삭제 실패: ${err.message}`)]; statusMsg = red("실패"); }
    render();
  }

  async function uploadSelectedPromptToStore() {
    if (!prompts[selected]?.dbId) { detail = [red("DB ID 없음")]; render(); return; }
    const p = prompts[selected];
    detail = [bold(p.name), "", yellow("스토어 등록 중...")]; render();
    try {
      const { uploadPromptToStore } = await import("../api/xgen-extra.js");
      await withTimeout(uploadPromptToStore(p.dbId!), 10000, "스토어");
      detail = [green("✓ 스토어 등록 완료!")]; statusMsg = green("등록 완료");
    } catch (err: any) { detail = [red(`실패: ${err.message}`)]; statusMsg = red("실패"); }
    render();
  }

  async function showPromptVersions() {
    if (!prompts[selected]?.uid) { detail = [red("UID 없음")]; render(); return; }
    const p = prompts[selected];
    detail = [bold(p.name), "", yellow("버전 로딩...")]; render();
    try {
      const { listPromptVersions } = await import("../api/xgen-extra.js");
      const vers = await withTimeout(listPromptVersions(p.uid!), 8000, "버전") as any[];
      if (!vers.length) { detail = [bold(p.name), "", dim("버전 없음")]; }
      else {
        detail = [bold(p.name), "", bold(`버전 ${vers.length}개:`), "",
          ...vers.slice(0, 15).map((v: any, i: number) => `  ${i + 1}. v${v.version ?? v.id ?? "?"} ${dim(v.label_name ?? v.created_at ?? "")}`)
        ];
      }
    } catch (err: any) { detail = [red(`실패: ${err.message}`)]; }
    render();
  }

  // ── 액션: 도구 ──
  function startCreateTool() {
    startForm("create-tool", "새 도구 생성", [
      { key: "function_name", label: "도구 이름", required: true },
      { key: "function_id", label: "도구 ID (영문)", required: true },
      { key: "description", label: "설명" },
      { key: "api_url", label: "API URL", required: true },
      { key: "api_method", label: "HTTP 메서드", default: "GET" },
      { key: "api_timeout", label: "타임아웃(초)", default: "30" },
    ], async (v) => {
      detail = [bold("도구 생성"), "", yellow("저장 중...")]; render();
      try {
        const { saveTool } = await import("../api/xgen-extra.js");
        await withTimeout(saveTool(v.function_name, {
          function_name: v.function_name, function_id: v.function_id, description: v.description || "",
          api_url: v.api_url, api_method: v.api_method || "GET", api_timeout: parseInt(v.api_timeout || "30"),
        }), 10000, "저장");
        detail = [green("✓ 도구 저장 완료!"), "", "r 새로고침"]; statusMsg = green("저장 완료");
      } catch (err: any) { detail = [red(`✗ 실패: ${err.message}`)]; statusMsg = red("실패"); }
      render();
    });
  }

  async function testSelectedTool() {
    if (!tools[selected]) return;
    const t = tools[selected];
    if (!t.apiUrl) { detail = [bold(t.name), "", red("API URL 없음")]; render(); return; }
    detail = [bold(t.name), "", yellow("API 테스트 중..."), `URL: ${t.apiUrl}`]; render();
    try {
      const { apiTest } = await import("../api/xgen-extra.js");
      const r = await withTimeout(apiTest({ api_url: t.apiUrl, api_method: "GET", api_timeout: 15 }), 20000, "테스트") as any;
      const ok = r?.success ?? (r?.data?.status && r.data.status < 400);
      const st = r?.data?.status ?? "?";
      const resp = r?.data?.response;
      const lines = (typeof resp === "string" ? resp : JSON.stringify(resp ?? {}, null, 2)).split("\n").slice(0, 12);
      detail = [bold(t.name), "", ok ? green(`✓ ${st} OK`) : red(`✗ ${st} FAIL`), "", bold("응답:"), ...lines];
      statusMsg = ok ? green("테스트 성공") : red("테스트 실패");
    } catch (err: any) { detail = [bold(t.name), "", red(`실패: ${err.message}`)]; statusMsg = red("실패"); }
    render();
  }

  async function uploadSelectedTool() {
    if (!tools[selected]?.functionId) { detail = [red("function_id 없음")]; render(); return; }
    const t = tools[selected];
    detail = [bold(t.name), "", yellow("스토어 등록 중...")]; render();
    try {
      const { uploadToolToStore } = await import("../api/xgen-extra.js");
      await withTimeout(uploadToolToStore(t.functionId!, t.desc), 10000, "등록");
      detail = [green("✓ 스토어 등록 완료!")]; statusMsg = green("등록 완료");
    } catch (err: any) { detail = [red(`실패: ${err.message}`)]; statusMsg = red("실패"); }
    render();
  }

  // ── 액션: MCP ──
  function startCreateMcpSession() {
    startForm("create-mcp", "MCP 세션 생성", [
      { key: "session_name", label: "세션 이름", required: true },
      { key: "server_type", label: "타입 (python/node)", required: true, default: "python" },
      { key: "server_command", label: "서버 커맨드", required: true },
      { key: "server_args", label: "추가 인자 (쉼표 구분)" },
      { key: "working_dir", label: "작업 디렉토리" },
    ], async (v) => {
      detail = [yellow("MCP 세션 생성 중...")]; render();
      try {
        const { createMcpSession } = await import("../api/xgen-extra.js");
        const args = v.server_args ? v.server_args.split(",").map(a => a.trim()) : undefined;
        const r = await withTimeout(createMcpSession({
          server_type: v.server_type as "python" | "node",
          server_command: v.server_command, session_name: v.session_name,
          server_args: args, working_dir: v.working_dir || undefined,
        }), 15000, "MCP 세션") as any;
        detail = [green("✓ 세션 생성 완료!"), "", `세션ID: ${r?.session_id ?? "?"}`, "", "r 새로고침"];
        statusMsg = green("MCP 세션 생성 완료");
      } catch (err: any) { detail = [red(`✗ 실패: ${err.message}`)]; statusMsg = red("실패"); }
      render();
    });
  }

  async function loadMcpTools() {
    if (!mcpSessions[selected]) return;
    const s = mcpSessions[selected];
    detail = [bold(s.name), "", yellow("도구 목록 로딩...")]; render();
    try {
      const { getMcpSessionTools } = await import("../api/xgen-extra.js");
      const tools = await withTimeout(getMcpSessionTools(s.id), 10000, "MCP 도구") as any[];
      if (!tools.length) { detail = [bold(s.name), "", dim("도구 없음")]; }
      else {
        detail = [bold(s.name), "", bold(`도구 ${tools.length}개:`), "",
          ...tools.slice(0, 15).map((t: any, i: number) => {
            const name = t.name ?? t.function?.name ?? "?";
            const desc = (t.description ?? t.function?.description ?? "").slice(0, 40);
            return `  ${i + 1}. ${name} ${dim(desc)}`;
          }),
          ...(tools.length > 15 ? [dim(`  ... +${tools.length - 15}개`)] : []),
          "", cyan("t") + " 도구 호출 테스트",
        ];
      }
    } catch (err: any) { detail = [bold(s.name), "", red(`실패: ${err.message}`)]; }
    render();
  }

  function startMcpToolCall() {
    if (!mcpSessions[selected]) return;
    const s = mcpSessions[selected];
    startForm("mcp-call", `MCP 도구 호출: ${s.name}`, [
      { key: "tool_name", label: "도구 이름", required: true },
      { key: "params_json", label: "파라미터 (JSON)", default: "{}" },
    ], async (v) => {
      detail = [yellow("MCP 도구 호출 중...")]; render();
      try {
        const { sendMcpRequest } = await import("../api/xgen-extra.js");
        let params: Record<string, unknown> = {};
        try { params = JSON.parse(v.params_json || "{}"); } catch {}
        const r = await withTimeout(sendMcpRequest(s.id, "tools/call", { name: v.tool_name, arguments: params }), 20000, "MCP 호출") as any;
        const ok = r?.success;
        const data = r?.data;
        const lines = (typeof data === "string" ? data : JSON.stringify(data ?? {}, null, 2)).split("\n").slice(0, 15);
        detail = [bold(`${s.name} → ${v.tool_name}`), "", ok ? green("✓ 성공") : red("✗ 실패"), "", bold("응답:"), ...lines];
        statusMsg = ok ? green("호출 성공") : red("호출 실패");
      } catch (err: any) { detail = [red(`실패: ${err.message}`)]; statusMsg = red("실패"); }
      render();
    });
  }

  async function deleteSelectedMcpSession() {
    if (!mcpSessions[selected]) return;
    const s = mcpSessions[selected];
    detail = [bold(s.name), "", yellow("삭제 중...")]; render();
    try {
      const { deleteMcpSession } = await import("../api/xgen-extra.js");
      await withTimeout(deleteMcpSession(s.id), 10000, "삭제");
      detail = [green("✓ 세션 삭제 완료!"), "", "r 새로고침"]; statusMsg = green("삭제 완료");
    } catch (err: any) { detail = [red(`실패: ${err.message}`)]; statusMsg = red("실패"); }
    render();
  }

  // ── 폼 헬퍼 ──
  function startForm(type: string, title: string, fields: FormField[], onSubmit: (v: Record<string, string>) => Promise<void>) {
    formCtx = { type, fields, step: 0, values: {}, onSubmit };
    inputBuffer = "";
    detail = [bold(title), "",
      ...fields.map((f, i) => `  ${i === 0 ? cyan("▸") : " "} ${f.label}${f.required ? red("*") : ""} ${f.default ? dim(`(기본: ${f.default})`) : ""}`),
      "", dim("Enter: 다음 │ Esc: 취소"),
    ];
    statusMsg = `${fields[0].label} 입력`;
    render();
  }

  // ── 키 핸들러 ──
  function handleKey(s: string) {
    // 폼 모드
    if (formCtx) {
      if (s === "\x1b" || s === "\x1b\x1b") { formCtx = null; inputBuffer = ""; inputMode = false; updateDetail(); statusMsg = getHint(); render(); return; }
      if (s === "\r" || s === "\n") {
        const field = formCtx.fields[formCtx.step];
        const value = inputBuffer.trim() || field.default || "";
        if (field.required && !value) { statusMsg = red(`${field.label} 필수`); render(); return; }
        formCtx.values[field.key] = value; inputBuffer = ""; formCtx.step++;
        if (formCtx.step >= formCtx.fields.length) {
          const ctx = formCtx; formCtx = null; inputMode = false; ctx.onSubmit(ctx.values);
        } else {
          const nf = formCtx.fields[formCtx.step];
          detail = [bold(formCtx.type.includes("tool") ? "새 도구" : formCtx.type.includes("prompt") ? "새 프롬프트" : formCtx.type.includes("mcp") ? "MCP" : "입력"), "",
            ...formCtx.fields.map((f, i) => {
              const val = formCtx!.values[f.key];
              if (val !== undefined) return `  ${green("✓")} ${f.label}: ${val}`;
              if (i === formCtx!.step) return `  ${cyan("▸")} ${f.label}${f.required ? red("*") : ""} ${f.default ? dim(`(기본: ${f.default})`) : ""}`;
              return `    ${f.label}`;
            }),
            "", dim(`${formCtx.step + 1}/${formCtx.fields.length} │ Enter │ Esc`),
          ];
          statusMsg = `${nf.label} 입력`; render();
        }
        return;
      }
      if (s === "\x7f" || s === "\b") { inputBuffer = inputBuffer.slice(0, -1); render(); return; }
      if (s === "\x03") { formCtx = null; inputBuffer = ""; inputMode = false; updateDetail(); render(); return; }
      if (s.length > 0 && s.charCodeAt(0) >= 32) { inputBuffer += s; render(); return; }
      return;
    }

    // 일반 입력 모드
    if (inputMode) {
      if (s === "\x1b" || s === "\x1b\x1b") { inputMode = false; inputBuffer = ""; updateDetail(); statusMsg = getHint(); render(); return; }
      if (s === "\r" || s === "\n") {
        const val = inputBuffer.trim(); inputMode = false; inputBuffer = "";
        if (val && tab === "workflows" && workflows[selected]) { runWorkflow(workflows[selected], val); }
        else { render(); }
        return;
      }
      if (s === "\x7f" || s === "\b") { inputBuffer = inputBuffer.slice(0, -1); render(); return; }
      if (s === "\x03") { inputMode = false; inputBuffer = ""; render(); return; }
      if (s.length > 0 && s.charCodeAt(0) >= 32) { inputBuffer += s; render(); return; }
      return;
    }

    // ── 일반 모드 ──
    if (s === "q" || s === "\x03") { cleanup(); process.exit(0); }
    if (s === "r" || s === "R") { loadData(); return; }

    // i — 워크플로우 실행 입력
    if (s === "i" && tab === "workflows" && workflows[selected]) {
      inputMode = true; inputBuffer = "";
      statusMsg = `${workflows[selected].name} — 질문 입력 후 Enter, Esc 취소`;
      render(); return;
    }

    // c — 생성
    if (s === "c" || s === "C") {
      if (tab === "tools") { startCreateTool(); return; }
      if (tab === "prompts") { startCreatePrompt(); return; }
      if (tab === "mcp") { startCreateMcpSession(); return; }
    }
    // t — 테스트
    if (s === "t" || s === "T") {
      if (tab === "tools") { testSelectedTool(); return; }
      if (tab === "mcp") { startMcpToolCall(); return; }
    }
    // u — 스토어 등록
    if (s === "u" || s === "U") {
      if (tab === "tools") { uploadSelectedTool(); return; }
      if (tab === "prompts") { uploadSelectedPromptToStore(); return; }
    }
    // e — 수정
    if (s === "e" || s === "E") {
      if (tab === "prompts") { startEditPrompt(); return; }
    }
    // d — 삭제
    if (s === "d" || s === "D") {
      if (tab === "prompts") { deleteSelectedPrompt(); return; }
      if (tab === "mcp") { deleteSelectedMcpSession(); return; }
    }
    // v — 버전
    if (s === "v" || s === "V") {
      if (tab === "prompts") { showPromptVersions(); return; }
    }

    // 탭 전환
    const tabNum = parseInt(s);
    if (tabNum >= 1 && tabNum <= 6) {
      tab = TABS[tabNum - 1].key; selected = 0; updateDetail(); statusMsg = getHint(); render(); return;
    }
    if (s === "\t") { const idx = TABS.findIndex(t => t.key === tab); tab = TABS[(idx + 1) % TABS.length].key; selected = 0; updateDetail(); statusMsg = getHint(); render(); return; }
    if (s === "\x1b[Z") { const idx = TABS.findIndex(t => t.key === tab); tab = TABS[(idx - 1 + TABS.length) % TABS.length].key; selected = 0; updateDetail(); statusMsg = getHint(); render(); return; }

    // 방향키
    if (s === "\x1b[A") { const items = getItems(); if (items.length > 0) { selected = Math.max(0, selected - 1); updateDetail(); render(); } return; }
    if (s === "\x1b[B") { const items = getItems(); if (items.length > 0) { selected = Math.min(items.length - 1, selected + 1); updateDetail(); render(); } return; }
    if (s === "\x1b[5~") { selected = Math.max(0, selected - 10); updateDetail(); render(); return; }
    if (s === "\x1b[6~") { const items = getItems(); selected = Math.min(items.length - 1, selected + 10); updateDetail(); render(); return; }

    // Enter
    if (s === "\r" || s === "\n") {
      const items = getItems();
      if (items.length === 0) return;
      if (tab === "workflows" && workflows[selected]) { loadWorkflowStructure(workflows[selected]); }
      else if (tab === "collections" && collections[selected]) {
        const c = collections[selected];
        detail = [bold(c.name), "", yellow("문서 로딩...")]; render();
        import("../api/document.js").then(async (m) => {
          try {
            const docs = await withTimeout(m.listDocuments(String(c.id)), 8000, "문서");
            if (!docs?.length) { detail = [bold(c.name), "", dim("문서 없음")]; }
            else { detail = [bold(c.name) + ` — ${docs.length}개`, "", ...docs.map((d: any, i: number) => `  ${i + 1}. ${d.name || d.file_name || "?"}`).slice(0, 20)]; }
          } catch (err: any) { detail = [red(`실패: ${err.message}`)]; }
          render();
        });
      }
      else if (tab === "nodes" && nodes[selected]) { loadNodeDetail(nodes[selected]); }
      else if (tab === "prompts" && prompts[selected]) {
        const p = prompts[selected];
        detail = [bold(p.name), `타입: ${p.type}`, `UID: ${p.uid || "?"}`, "", bold("내용:"), "", ...(p.content ? p.content.split("\n").slice(0, 18) : [dim("없음")])];
        render();
      }
      else if (tab === "tools" && tools[selected]) { testSelectedTool(); }
      else if (tab === "mcp" && mcpSessions[selected]) { loadMcpTools(); }
      return;
    }
  }

  function cleanup() {
    showCursor(); clear();
    if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false);
    process.stdin.removeAllListeners("data"); process.stdin.pause();
  }

  // ── 시작 ──
  if (!process.stdin.isTTY) { console.error("대시보드는 터미널(TTY)에서만 실행 가능합니다."); return; }
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8"); hideCursor();
  process.stdin.on("data", (data: any) => { try { handleKey(String(data)); } catch (err: any) { statusMsg = red(`오류: ${err.message}`); render(); } });
  process.stdout.on("resize", () => render());
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("exit", () => { showCursor(); });
  // 백그라운드 로드 — 로딩 중에도 키 입력 즉시 반응
  loadData();
  await new Promise<void>(() => {});
}
