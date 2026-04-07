/**
 * XGEN 플랫폼 API 도구 — AI 에이전트가 XGEN 기능을 사용할 수 있게
 */
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { getAuth, getServer } from "../../config/store.js";

// ── 도구 정의 ──

export const definitions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "xgen_workflow_list",
      description: "XGEN 서버에서 워크플로우 목록을 가져옵니다.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "xgen_workflow_run",
      description: "XGEN 워크플로우를 실행합니다. 배포 여부와 관계없이 모든 워크플로우 실행 가능.",
      parameters: {
        type: "object",
        properties: {
          workflow_id: { type: "string", description: "워크플로우 ID" },
          workflow_name: { type: "string", description: "워크플로우 이름" },
          input_data: { type: "string", description: "입력 메시지" },
        },
        required: ["workflow_id", "workflow_name", "input_data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "xgen_workflow_info",
      description: "특정 워크플로우의 상세 정보(노드, 엣지 등)를 가져옵니다.",
      parameters: {
        type: "object",
        properties: {
          workflow_id: { type: "string", description: "워크플로우 ID" },
        },
        required: ["workflow_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "xgen_collection_list",
      description: "XGEN 서버의 문서 컬렉션(지식베이스) 목록을 가져옵니다. 문서 수, 청크 수, 공유 상태 등 포함.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "xgen_server_status",
      description: "XGEN 서버 상태를 확인합니다.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "xgen_execution_history",
      description: "특정 워크플로우의 실행 이력을 가져옵니다. workflow_id와 workflow_name 필수.",
      parameters: {
        type: "object",
        properties: {
          workflow_id: { type: "string", description: "워크플로우 ID" },
          workflow_name: { type: "string", description: "워크플로우 이름" },
          limit: { type: "number", description: "가져올 이력 수 (기본 10)" },
        },
        required: ["workflow_id", "workflow_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "xgen_document_list",
      description: "특정 컬렉션의 문서 목록을 가져옵니다.",
      parameters: {
        type: "object",
        properties: {
          collection_id: { type: "string", description: "컬렉션 ID" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "xgen_document_upload",
      description: "문서를 XGEN 컬렉션에 업로드합니다.",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "업로드할 파일 경로" },
          collection_id: { type: "string", description: "대상 컬렉션 ID" },
        },
        required: ["file_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "xgen_graph_rag_query",
      description: "GraphRAG로 온톨로지 지식그래프에 질의합니다.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "질의 내용" },
          graph_id: { type: "string", description: "그래프 ID (선택)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "xgen_graph_stats",
      description: "온톨로지 그래프 통계(노드, 엣지, 클래스, 인스턴스 수)를 가져옵니다.",
      parameters: {
        type: "object",
        properties: {
          graph_id: { type: "string", description: "그래프 ID" },
        },
        required: ["graph_id"],
      },
    },
  },
];

// ── 도구 실행 ──

export async function execute(name: string, args: Record<string, unknown>): Promise<string> {
  const server = getServer();
  const auth = getAuth();

  if (!server || !auth) {
    return "XGEN 서버에 연결되어 있지 않습니다. /connect 명령으로 연결하세요.";
  }

  try {
    switch (name) {
      case "xgen_workflow_list":
        return await workflowList();
      case "xgen_workflow_run":
        return await workflowRun(args);
      case "xgen_workflow_info":
        return await workflowInfo(args);
      case "xgen_collection_list":
        return await collectionList();
      case "xgen_server_status":
        return await serverStatus();
      case "xgen_execution_history":
        return await executionHistory(args);
      case "xgen_document_list":
        return await documentList(args);
      case "xgen_document_upload":
        return await documentUpload(args);
      case "xgen_graph_rag_query":
        return await graphRagQuery(args);
      case "xgen_graph_stats":
        return await graphStats(args);
      default:
        return `Unknown XGEN tool: ${name}`;
    }
  } catch (err) {
    return `XGEN API 오류: ${(err as Error).message}`;
  }
}

export function isXgenTool(name: string): boolean {
  return name.startsWith("xgen_");
}

// ── 내부 구현 ──

async function workflowList(): Promise<string> {
  const { getWorkflowListDetail } = await import("../../api/workflow.js");
  const wfs = await getWorkflowListDetail();
  if (!wfs.length) return "워크플로우 없음.";
  return wfs.map((w, i) => {
    const deployed = (w as Record<string, unknown>).is_deployed;
    const dk = (w as Record<string, unknown>).deploy_key;
    const tag = deployed ? " [배포됨]" : "";
    return `${i + 1}. ${w.workflow_name}${tag}\n   ID: ${w.workflow_id ?? w.id}\n   deploy_key: ${dk || "없음"}`;
  }).join("\n");
}

async function workflowRun(args: Record<string, unknown>): Promise<string> {
  const { executeWorkflow } = await import("../../api/workflow.js");
  const { randomUUID } = await import("node:crypto");
  const { getAuth } = await import("../../config/store.js");
  const auth = getAuth();
  const result = await executeWorkflow({
    workflow_id: args.workflow_id as string,
    workflow_name: args.workflow_name as string,
    input_data: args.input_data as string,
    interaction_id: `cli_${randomUUID().slice(0, 8)}`,
    user_id: auth?.userId ? parseInt(auth.userId) : 1,
  }) as Record<string, unknown>;
  if (result.content) return String(result.content);
  if (result.success === false) return `오류: ${result.error ?? result.message}`;
  if (result.message) return String(result.message);
  return JSON.stringify(result, null, 2).slice(0, 2000);
}

async function workflowInfo(args: Record<string, unknown>): Promise<string> {
  const { getWorkflowDetail } = await import("../../api/workflow.js");
  const detail = await getWorkflowDetail(args.workflow_id as string);
  const nodes = (detail.nodes as unknown[])?.length ?? 0;
  const edges = (detail.edges as unknown[])?.length ?? 0;
  return `워크플로우: ${detail.workflow_name}\nID: ${detail.id}\n노드: ${nodes}개\n엣지: ${edges}개`;
}

async function collectionList(): Promise<string> {
  const { listCollections } = await import("../../api/document.js");
  const cols = await listCollections();
  if (!cols.length) return "컬렉션 없음.";
  return cols.map((c, i) => {
    const shared = c.is_shared ? ` [공유:${c.share_group}]` : "";
    return `${i + 1}. ${c.collection_make_name}${shared}\n   문서: ${c.total_documents}개 · 청크: ${c.total_chunks}개 · 모델: ${c.init_embedding_model ?? "-"}`;
  }).join("\n");
}

async function serverStatus(): Promise<string> {
  const server = getServer();
  const auth = getAuth();
  return `서버: ${server}\n사용자: ${auth?.username}\nUser ID: ${auth?.userId}`;
}

async function executionHistory(args: Record<string, unknown>): Promise<string> {
  const { getIOLogs } = await import("../../api/workflow.js");
  const wfId = args.workflow_id as string;
  const wfName = args.workflow_name as string;
  if (!wfId || !wfName) return "workflow_id와 workflow_name이 필요합니다. 먼저 xgen_workflow_list로 목록을 확인하세요.";
  const limit = (args.limit as number) || 10;
  const logs = await getIOLogs(wfId, wfName, limit);
  if (!logs.length) return "실행 이력 없음.";
  return logs.map((l, i) =>
    `${i + 1}. [${l.created_at ?? ""}]\n   입력: ${(l.input_data ?? "").slice(0, 80)}\n   출력: ${(l.output_data ?? "").slice(0, 80)}`
  ).join("\n");
}

async function documentList(args: Record<string, unknown>): Promise<string> {
  const { listDocuments } = await import("../../api/document.js");
  const docs = await listDocuments(args.collection_id as string | undefined);
  if (!docs.length) return "문서 없음.";
  return docs.map((d, i) => {
    const name = d.name || d.file_name || "이름 없음";
    const size = d.file_size ? ` (${(d.file_size / 1024).toFixed(1)}KB)` : "";
    return `${i + 1}. ${name}${size}\n   상태: ${d.status ?? "-"} · 타입: ${d.file_type ?? "-"}`;
  }).join("\n");
}

async function documentUpload(args: Record<string, unknown>): Promise<string> {
  const { uploadDocument } = await import("../../api/document.js");
  const filePath = args.file_path as string;
  if (!filePath) return "파일 경로가 필요합니다.";
  const { existsSync } = await import("node:fs");
  if (!existsSync(filePath)) return `파일을 찾을 수 없습니다: ${filePath}`;
  const result = await uploadDocument(filePath, args.collection_id as string | undefined);
  return `업로드 완료: ${JSON.stringify(result)}`;
}

async function graphRagQuery(args: Record<string, unknown>): Promise<string> {
  const { queryGraphRAG } = await import("../../api/ontology.js");
  const query = args.query as string;
  if (!query) return "질의 내용이 필요합니다.";
  const result = await queryGraphRAG(query, args.graph_id as string | undefined);
  let output = `답변: ${result.answer ?? "없음"}`;
  if (result.sources?.length) output += `\n\n출처: ${result.sources.join(", ")}`;
  if (result.triples_used?.length) output += `\n트리플: ${result.triples_used.length}개 사용`;
  return output;
}

async function graphStats(args: Record<string, unknown>): Promise<string> {
  const { getGraphStats } = await import("../../api/ontology.js");
  const stats = await getGraphStats(args.graph_id as string);
  return `노드: ${stats.total_nodes ?? 0}개\n엣지: ${stats.total_edges ?? 0}개\n클래스: ${stats.total_classes ?? 0}개\n인스턴스: ${stats.total_instances ?? 0}개`;
}
