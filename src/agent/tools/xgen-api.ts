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
      description: "XGEN 워크플로우를 실행합니다. 배포된 워크플로우만 실행 가능.",
      parameters: {
        type: "object",
        properties: {
          workflow_id: { type: "string", description: "워크플로우 ID" },
          workflow_name: { type: "string", description: "워크플로우 이름" },
          input_data: { type: "string", description: "입력 메시지" },
          deploy_key: { type: "string", description: "배포 키 (배포된 워크플로우)" },
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
      name: "xgen_doc_list",
      description: "XGEN 서버에서 문서 목록을 가져옵니다.",
      parameters: {
        type: "object",
        properties: {
          collection_id: { type: "string", description: "컬렉션 ID (선택)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "xgen_ontology_query",
      description: "온톨로지(GraphRAG)에 질문합니다. 지식 그래프 기반 검색.",
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
      name: "xgen_server_status",
      description: "XGEN 서버 상태를 확인합니다.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "xgen_execution_history",
      description: "워크플로우 실행 이력을 가져옵니다.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "가져올 이력 수 (기본 10)" },
        },
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
      case "xgen_doc_list":
        return await docList(args);
      case "xgen_ontology_query":
        return await ontologyQuery(args);
      case "xgen_server_status":
        return await serverStatus();
      case "xgen_execution_history":
        return await executionHistory(args);
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
  const result = await executeWorkflow({
    workflow_id: args.workflow_id as string,
    workflow_name: args.workflow_name as string,
    input_data: args.input_data as string,
    interaction_id: `cli_${randomUUID().slice(0, 8)}`,
    deploy_key: args.deploy_key as string | undefined,
  }) as Record<string, unknown>;
  if (result.content) return String(result.content);
  if (result.success === false) return `오류: ${result.error ?? result.message}`;
  return JSON.stringify(result, null, 2).slice(0, 2000);
}

async function workflowInfo(args: Record<string, unknown>): Promise<string> {
  const { getWorkflowDetail } = await import("../../api/workflow.js");
  const detail = await getWorkflowDetail(args.workflow_id as string);
  const nodes = (detail.nodes as unknown[])?.length ?? 0;
  const edges = (detail.edges as unknown[])?.length ?? 0;
  return `워크플로우: ${detail.workflow_name}\nID: ${detail.id}\n노드: ${nodes}개\n엣지: ${edges}개`;
}

async function docList(args: Record<string, unknown>): Promise<string> {
  const { listDocuments } = await import("../../api/document.js");
  const docs = await listDocuments(args.collection_id as string | undefined);
  if (!docs.length) return "문서 없음.";
  return docs.map((d, i) =>
    `${i + 1}. ${d.file_name ?? d.name ?? "-"} (${d.file_type ?? "-"}) — ${d.status ?? "-"}`
  ).join("\n");
}

async function ontologyQuery(args: Record<string, unknown>): Promise<string> {
  const { queryGraphRAG } = await import("../../api/ontology.js");
  const result = await queryGraphRAG(args.query as string, args.graph_id as string | undefined);
  let output = "";
  if (result.answer) output += `답변: ${result.answer}\n`;
  if (result.sources?.length) output += `출처: ${result.sources.join(", ")}\n`;
  if (result.triples_used?.length) output += `트리플: ${result.triples_used.join("; ")}`;
  return output || "결과 없음.";
}

async function serverStatus(): Promise<string> {
  const server = getServer();
  const auth = getAuth();
  return `서버: ${server}\n사용자: ${auth?.username}\nUser ID: ${auth?.userId}`;
}

async function executionHistory(args: Record<string, unknown>): Promise<string> {
  const { getIOLogs } = await import("../../api/workflow.js");
  const limit = (args.limit as number) || 10;
  const logs = await getIOLogs(undefined, limit);
  if (!logs.length) return "실행 이력 없음.";
  return logs.map((l, i) =>
    `${i + 1}. [${l.created_at ?? ""}]\n   입력: ${(l.input_data ?? "").slice(0, 80)}\n   출력: ${(l.output_data ?? "").slice(0, 80)}`
  ).join("\n");
}
