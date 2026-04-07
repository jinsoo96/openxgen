/**
 * ToolSearch — Progressive Disclosure 핵심 도구
 *
 * 도구 35개를 매번 전달하는 대신, 인덱스만 시스템 프롬프트에 노출하고
 * 에이전트가 필요할 때 이 도구로 스키마를 온디맨드 로드한다.
 */
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { definitions as xgenDefs } from "./xgen-api.js";

// ── 도구 인덱스 — 카테고리별 요약 (시스템 프롬프트에 노출) ──

export const TOOL_INDEX: Record<string, { description: string; tools: string[] }> = {
  workflow: {
    description: "워크플로우 관리 — 목록, 실행, 상세, 이력, 성능, 스토어, 자동생성",
    tools: ["xgen_workflow_list", "xgen_workflow_run", "xgen_workflow_info", "xgen_execution_history", "xgen_workflow_performance", "xgen_workflow_store", "xgen_workflow_generate"],
  },
  document: {
    description: "문서/컬렉션 관리 — 컬렉션 목록, 문서 목록, 업로드",
    tools: ["xgen_collection_list", "xgen_document_list", "xgen_document_upload"],
  },
  node: {
    description: "노드 탐색 — 전체 목록, 검색, 카테고리",
    tools: ["xgen_node_list", "xgen_node_search", "xgen_node_categories"],
  },
  prompt: {
    description: "프롬프트 라이브러리 — 목록 조회",
    tools: ["xgen_prompt_list"],
  },
  tool: {
    description: "도구 스토어 — 공개 도구, 내 도구",
    tools: ["xgen_tool_store", "xgen_user_tools"],
  },
  schedule: {
    description: "스케줄 관리 — cron 작업 목록",
    tools: ["xgen_schedule_list"],
  },
  trace: {
    description: "트레이스/인터랙션 — 실행 추적, 메타데이터",
    tools: ["xgen_trace_list", "xgen_interaction_list"],
  },
  graph: {
    description: "온톨로지 GraphRAG — 질의, 그래프 통계",
    tools: ["xgen_graph_rag_query", "xgen_graph_stats"],
  },
  mcp: {
    description: "MCP 세션 관리 — 세션 목록",
    tools: ["xgen_mcp_sessions"],
  },
  server: {
    description: "서버 상태 확인",
    tools: ["xgen_server_status"],
  },
};

// ── 로드된 도구 추적 ──

const loadedTools = new Set<string>();

/**
 * 인덱스 요약 문자열 — 시스템 프롬프트에 삽입
 */
export function getToolIndexSummary(): string {
  const lines = Object.entries(TOOL_INDEX).map(
    ([cat, info]) => `  - ${cat}: ${info.description}`
  );
  return `Available XGEN tool categories (use tool_search to load):\n${lines.join("\n")}`;
}

/**
 * 카테고리 또는 키워드로 도구 스키마 검색 → 반환
 */
function searchTools(query: string): { tools: ChatCompletionTool[]; summary: string } {
  const q = query.toLowerCase().trim();
  const matched: ChatCompletionTool[] = [];
  const matchedNames: string[] = [];

  // 1. 카테고리 정확 매칭
  if (TOOL_INDEX[q]) {
    for (const name of TOOL_INDEX[q].tools) {
      const def = xgenDefs.find(d => d.function.name === name);
      if (def && !loadedTools.has(name)) {
        matched.push(def);
        loadedTools.add(name);
        matchedNames.push(name);
      }
    }
  }

  // 2. 키워드 매칭 — 도구 이름/설명에서 검색
  if (matched.length === 0) {
    for (const def of xgenDefs) {
      const name = def.function.name;
      const desc = def.function.description ?? "";
      if (
        (name.includes(q) || desc.toLowerCase().includes(q)) &&
        !loadedTools.has(name)
      ) {
        matched.push(def);
        loadedTools.add(name);
        matchedNames.push(name);
      }
    }
  }

  // 3. 카테고리 부분 매칭
  if (matched.length === 0) {
    for (const [cat, info] of Object.entries(TOOL_INDEX)) {
      if (cat.includes(q) || info.description.includes(q)) {
        for (const name of info.tools) {
          const def = xgenDefs.find(d => d.function.name === name);
          if (def && !loadedTools.has(name)) {
            matched.push(def);
            loadedTools.add(name);
            matchedNames.push(name);
          }
        }
      }
    }
  }

  if (matched.length === 0) {
    return {
      tools: [],
      summary: `"${query}"에 해당하는 도구 없음. 카테고리: ${Object.keys(TOOL_INDEX).join(", ")}`,
    };
  }

  return {
    tools: matched,
    summary: `${matched.length}개 도구 로드됨: ${matchedNames.join(", ")}`,
  };
}

/**
 * 현재 세션에서 로드된 도구 목록 반환
 */
export function getLoadedToolDefs(): ChatCompletionTool[] {
  return xgenDefs.filter(d => loadedTools.has(d.function.name));
}

/**
 * 세션 리셋 시 로드 상태 초기화
 */
export function resetLoadedTools(): void {
  loadedTools.clear();
}

// ── 도구 정의 + 실행 ──

export const definition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "tool_search",
    description: "XGEN 플랫폼 도구를 카테고리/키워드로 검색하여 로드합니다. 워크플로우, 문서, 노드, 프롬프트, 그래프 등의 도구를 필요할 때 이 도구로 로드하세요. 카테고리: workflow, document, node, prompt, tool, graph, mcp, trace, schedule, server",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "검색 카테고리 또는 키워드 (예: 'workflow', '노드', 'GraphRAG')",
        },
      },
      required: ["query"],
    },
  },
};

export async function execute(args: Record<string, unknown>): Promise<string> {
  const query = args.query as string;
  if (!query) return "query 파라미터 필요. 카테고리: " + Object.keys(TOOL_INDEX).join(", ");
  const result = searchTools(query);
  return result.summary;
}

/**
 * tool_search 실행 후 새로 로드된 도구를 세션 tools에 추가하기 위한 콜백
 * agent.ts의 runLoop에서 사용
 */
export function getNewlyLoadedTools(query: string): ChatCompletionTool[] {
  const result = searchTools(query);
  return result.tools;
}
