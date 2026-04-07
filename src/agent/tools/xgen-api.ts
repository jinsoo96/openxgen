/**
 * XGEN 플랫폼 API 도구 — AI 에이전트가 XGEN 전체 기능을 사용
 */
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { getAuth, getServer } from "../../config/store.js";

// ── 도구 정의 ──

export const definitions: ChatCompletionTool[] = [
  // === 워크플로우 ===
  { type: "function", function: { name: "xgen_workflow_list", description: "XGEN 워크플로우 전체 목록. 배포 상태 포함.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "xgen_workflow_run", description: "워크플로우 실행. 배포/비배포 모두 가능.", parameters: { type: "object", properties: { workflow_id: { type: "string" }, workflow_name: { type: "string" }, input_data: { type: "string", description: "입력 메시지" } }, required: ["workflow_id", "workflow_name", "input_data"] } } },
  { type: "function", function: { name: "xgen_workflow_info", description: "워크플로우 상세 (노드, 엣지 구조).", parameters: { type: "object", properties: { workflow_id: { type: "string" } }, required: ["workflow_id"] } } },
  { type: "function", function: { name: "xgen_execution_history", description: "워크플로우 실행 이력.", parameters: { type: "object", properties: { workflow_id: { type: "string" }, workflow_name: { type: "string" }, limit: { type: "number" } }, required: ["workflow_id", "workflow_name"] } } },
  { type: "function", function: { name: "xgen_workflow_performance", description: "워크플로우 성능 통계 (노드별 처리 시간, 리소스 사용).", parameters: { type: "object", properties: { workflow_id: { type: "string" }, workflow_name: { type: "string" } }, required: ["workflow_id", "workflow_name"] } } },
  { type: "function", function: { name: "xgen_workflow_store", description: "공개 워크플로우 스토어 목록.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "xgen_workflow_generate", description: "자연어 요구사항으로 워크플로우 자동 생성.", parameters: { type: "object", properties: { requirements: { type: "string", description: "생성할 워크플로우 요구사항" } }, required: ["requirements"] } } },

  // === 문서/컬렉션 ===
  { type: "function", function: { name: "xgen_collection_list", description: "문서 컬렉션(지식베이스) 목록.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "xgen_document_list", description: "컬렉션의 문서 목록.", parameters: { type: "object", properties: { collection_id: { type: "string" } } } } },
  { type: "function", function: { name: "xgen_document_upload", description: "문서 업로드.", parameters: { type: "object", properties: { file_path: { type: "string" }, collection_id: { type: "string" } }, required: ["file_path"] } } },

  // === 노드 ===
  { type: "function", function: { name: "xgen_node_list", description: "XGEN 노드 전체 목록. 워크플로우 빌딩 블록.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "xgen_node_search", description: "노드 검색 (이름, 설명 기반).", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "xgen_node_categories", description: "노드 카테고리 목록.", parameters: { type: "object", properties: {} } } },

  // === 프롬프트 ===
  { type: "function", function: { name: "xgen_prompt_list", description: "프롬프트 라이브러리 목록.", parameters: { type: "object", properties: { language: { type: "string", description: "en 또는 ko" } } } } },

  // === 도구/스킬 ===
  { type: "function", function: { name: "xgen_tool_store", description: "공개 도구 스토어 목록.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "xgen_user_tools", description: "내 도구 목록.", parameters: { type: "object", properties: {} } } },

  // === 스케줄 ===
  { type: "function", function: { name: "xgen_schedule_list", description: "워크플로우 스케줄 목록 (cron 작업).", parameters: { type: "object", properties: {} } } },

  // === 트레이스/인터랙션 ===
  { type: "function", function: { name: "xgen_trace_list", description: "워크플로우 실행 트레이스 목록.", parameters: { type: "object", properties: { workflow_id: { type: "string" } } } } },
  { type: "function", function: { name: "xgen_interaction_list", description: "워크플로우 인터랙션(실행 메타) 목록.", parameters: { type: "object", properties: { workflow_id: { type: "string" }, limit: { type: "number" } } } } },

  // === MCP ===
  { type: "function", function: { name: "xgen_mcp_sessions", description: "XGEN MCP 서버 세션 목록.", parameters: { type: "object", properties: {} } } },

  // === GraphRAG ===
  { type: "function", function: { name: "xgen_graph_rag_query", description: "GraphRAG 온톨로지 질의.", parameters: { type: "object", properties: { query: { type: "string" }, graph_id: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "xgen_graph_stats", description: "온톨로지 그래프 통계.", parameters: { type: "object", properties: { graph_id: { type: "string" } }, required: ["graph_id"] } } },

  // === 서버 ===
  { type: "function", function: { name: "xgen_server_status", description: "XGEN 서버 연결 상태.", parameters: { type: "object", properties: {} } } },
];

// ── 실행 ──

export async function execute(name: string, args: Record<string, unknown>): Promise<string> {
  const server = getServer();
  const auth = getAuth();
  if (!server || !auth) return "XGEN 서버에 연결되어 있지 않습니다. /connect 명령으로 연결하세요.";

  try {
    const fn = handlers[name];
    if (!fn) return `Unknown XGEN tool: ${name}`;
    return await fn(args);
  } catch (err) {
    return `XGEN API 오류: ${(err as Error).message}`;
  }
}

export function isXgenTool(name: string): boolean {
  return name.startsWith("xgen_");
}

// ── 핸들러 맵 ──

const handlers: Record<string, (args: Record<string, unknown>) => Promise<string>> = {
  xgen_workflow_list: async () => {
    const { getWorkflowListDetail } = await import("../../api/workflow.js");
    const wfs = await getWorkflowListDetail();
    if (!wfs.length) return "워크플로우 없음.";
    return `총 ${wfs.length}개:\n` + wfs.map((w, i) => {
      const d = (w as Record<string, unknown>).is_deployed ? "●" : "○";
      return `${d} ${i + 1}. ${w.workflow_name} | ${w.workflow_id ?? w.id}`;
    }).join("\n");
  },

  xgen_workflow_run: async (args) => {
    const { executeWorkflow } = await import("../../api/workflow.js");
    const { randomUUID } = await import("node:crypto");
    const auth = getAuth();
    const r = await executeWorkflow({
      workflow_id: args.workflow_id as string,
      workflow_name: args.workflow_name as string,
      input_data: args.input_data as string,
      interaction_id: `cli_${randomUUID().slice(0, 8)}`,
      user_id: auth?.userId ? parseInt(auth.userId) : 1,
    }) as Record<string, unknown>;
    return r.content ? String(r.content) : r.message ? String(r.message) : JSON.stringify(r, null, 2).slice(0, 2000);
  },

  xgen_workflow_info: async (args) => {
    const { getWorkflowDetail } = await import("../../api/workflow.js");
    const d = await getWorkflowDetail(args.workflow_id as string);
    const nodes = (d.nodes as unknown[])?.length ?? 0;
    const edges = (d.edges as unknown[])?.length ?? 0;
    return `${d.workflow_name}\nID: ${d.id}\n노드: ${nodes}개 · 엣지: ${edges}개`;
  },

  xgen_execution_history: async (args) => {
    const { getIOLogs } = await import("../../api/workflow.js");
    if (!args.workflow_id || !args.workflow_name) return "workflow_id, workflow_name 필수.";
    const logs = await getIOLogs(args.workflow_id as string, args.workflow_name as string, (args.limit as number) || 10);
    if (!logs.length) return "실행 이력 없음.";
    return logs.map((l, i) => `${i + 1}. [${l.created_at ?? ""}] 입력: ${(l.input_data ?? "").slice(0, 60)} → 출력: ${(l.output_data ?? "").slice(0, 60)}`).join("\n");
  },

  xgen_workflow_performance: async (args) => {
    const { getWorkflowPerformance } = await import("../../api/xgen-extra.js");
    const p = await getWorkflowPerformance(args.workflow_id as string, args.workflow_name as string);
    return JSON.stringify(p, null, 2).slice(0, 2000);
  },

  xgen_workflow_store: async () => {
    const { listWorkflowStore } = await import("../../api/xgen-extra.js");
    const wfs = await listWorkflowStore();
    if (!wfs.length) return "공개 워크플로우 없음.";
    return wfs.map((w: any, i: number) => `${i + 1}. ${w.workflow_name ?? w.name ?? "이름없음"}`).join("\n");
  },

  xgen_workflow_generate: async (args) => {
    const { generateWorkflow } = await import("../../api/xgen-extra.js");
    const r = await generateWorkflow(args.requirements as string);
    return JSON.stringify(r, null, 2).slice(0, 3000);
  },

  xgen_collection_list: async () => {
    const { listCollections } = await import("../../api/document.js");
    const cols = await listCollections();
    if (!cols.length) return "컬렉션 없음.";
    return `총 ${cols.length}개:\n` + cols.map((c, i) =>
      `${i + 1}. ${c.collection_make_name} | ${c.total_documents}문서 ${c.total_chunks}청크${c.is_shared ? ` [공유:${c.share_group}]` : ""}`
    ).join("\n");
  },

  xgen_document_list: async (args) => {
    const { listDocuments } = await import("../../api/document.js");
    const docs = await listDocuments(args.collection_id as string | undefined);
    if (!docs.length) return "문서 없음.";
    return docs.map((d, i) => `${i + 1}. ${d.name || d.file_name || "이름없음"} ${d.file_type ?? ""} ${d.status ?? ""}`).join("\n");
  },

  xgen_document_upload: async (args) => {
    const { uploadDocument } = await import("../../api/document.js");
    const { existsSync } = await import("node:fs");
    if (!args.file_path) return "파일 경로 필요.";
    if (!existsSync(args.file_path as string)) return `파일 없음: ${args.file_path}`;
    const r = await uploadDocument(args.file_path as string, args.collection_id as string | undefined);
    return `업로드 완료: ${JSON.stringify(r)}`;
  },

  xgen_node_list: async () => {
    const { listNodes } = await import("../../api/xgen-extra.js");
    const nodes = await listNodes();
    if (!nodes.length) return "노드 없음.";
    return `총 ${nodes.length}개:\n` + (nodes as any[]).slice(0, 50).map((n, i) =>
      `${i + 1}. ${n.nodeName ?? n.name ?? n.node_id ?? "?"} ${n.description ? "— " + String(n.description).slice(0, 40) : ""}`
    ).join("\n") + (nodes.length > 50 ? `\n...(+${nodes.length - 50}개)` : "");
  },

  xgen_node_search: async (args) => {
    const { searchNodes } = await import("../../api/xgen-extra.js");
    const nodes = await searchNodes(args.query as string);
    if (!nodes.length) return "검색 결과 없음.";
    return (nodes as any[]).map((n, i) =>
      `${i + 1}. ${n.nodeName ?? n.name ?? "?"} — ${(n.description ?? "").slice(0, 60)}`
    ).join("\n");
  },

  xgen_node_categories: async () => {
    const { getNodeCategories } = await import("../../api/xgen-extra.js");
    const cats = await getNodeCategories();
    return (cats as any[]).map((c, i) => `${i + 1}. ${c.name ?? c.category ?? c}`).join("\n") || "카테고리 없음.";
  },

  xgen_prompt_list: async (args) => {
    const { listPrompts } = await import("../../api/xgen-extra.js");
    const prompts = await listPrompts({ language: args.language as string | undefined });
    if (!(prompts as any[]).length) return "프롬프트 없음.";
    return (prompts as any[]).slice(0, 30).map((p, i) =>
      `${i + 1}. ${p.name ?? p.title ?? "?"} [${p.prompt_type ?? ""}] ${(p.content ?? "").slice(0, 40)}...`
    ).join("\n");
  },

  xgen_tool_store: async () => {
    const { listToolStore } = await import("../../api/xgen-extra.js");
    const tools = await listToolStore();
    if (!(tools as any[]).length) return "공개 도구 없음.";
    return (tools as any[]).map((t, i) => `${i + 1}. ${t.name ?? t.tool_name ?? "?"} — ${(t.description ?? "").slice(0, 50)}`).join("\n");
  },

  xgen_user_tools: async () => {
    const { listUserTools } = await import("../../api/xgen-extra.js");
    const tools = await listUserTools();
    if (!(tools as any[]).length) return "내 도구 없음.";
    return (tools as any[]).map((t, i) => `${i + 1}. ${t.name ?? t.tool_name ?? "?"}`).join("\n");
  },

  xgen_schedule_list: async () => {
    const { listSchedules } = await import("../../api/xgen-extra.js");
    const sessions = await listSchedules();
    if (!(sessions as any[]).length) return "스케줄 없음.";
    return (sessions as any[]).map((s, i) => `${i + 1}. ${s.name ?? s.session_id ?? "?"} ${s.cron_expression ?? ""} [${s.status ?? "?"}]`).join("\n");
  },

  xgen_trace_list: async (args) => {
    const { listTraces } = await import("../../api/xgen-extra.js");
    const data = await listTraces(args.workflow_id as string | undefined) as any;
    const traces = data.traces ?? data ?? [];
    if (!traces.length) return "트레이스 없음.";
    return traces.slice(0, 20).map((t: any, i: number) =>
      `${i + 1}. ${t.trace_id ?? t.id ?? "?"} [${t.status ?? "?"}] ${t.created_at ?? ""}`
    ).join("\n");
  },

  xgen_interaction_list: async (args) => {
    const { listInteractions } = await import("../../api/xgen-extra.js");
    const items = await listInteractions(args.workflow_id as string | undefined, (args.limit as number) || 20);
    if (!(items as any[]).length) return "인터랙션 없음.";
    return (items as any[]).slice(0, 20).map((it: any, i: number) =>
      `${i + 1}. ${it.interaction_id ?? "?"} ${it.workflow_name ?? ""} [${it.status ?? "?"}]`
    ).join("\n");
  },

  xgen_mcp_sessions: async () => {
    const { listMcpSessions } = await import("../../api/xgen-extra.js");
    const sessions = await listMcpSessions();
    if (!(sessions as any[]).length) return "MCP 세션 없음.";
    return (sessions as any[]).map((s: any, i: number) =>
      `${i + 1}. ${s.session_name ?? s.session_id ?? "?"} [${s.server_type ?? "?"}] ${s.status ?? ""}`
    ).join("\n");
  },

  xgen_graph_rag_query: async (args) => {
    const { queryGraphRAG } = await import("../../api/ontology.js");
    if (!args.query) return "질의 내용 필요.";
    const r = await queryGraphRAG(args.query as string, args.graph_id as string | undefined);
    let out = `답변: ${r.answer ?? "없음"}`;
    if (r.sources?.length) out += `\n출처: ${r.sources.join(", ")}`;
    return out;
  },

  xgen_graph_stats: async (args) => {
    const { getGraphStats } = await import("../../api/ontology.js");
    const s = await getGraphStats(args.graph_id as string);
    return `노드: ${s.total_nodes ?? 0} · 엣지: ${s.total_edges ?? 0} · 클래스: ${s.total_classes ?? 0} · 인스턴스: ${s.total_instances ?? 0}`;
  },

  xgen_server_status: async () => {
    const server = getServer();
    const auth = getAuth();
    return `서버: ${server}\n사용자: ${auth?.username} (ID: ${auth?.userId})`;
  },
};
