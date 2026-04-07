# XGEN CLI 도구 시스템

## 현재 도구 정의 패턴

OpenAI ChatCompletionTool 포맷 → LLM에 직접 전달:
```typescript
{
  type: "function",
  function: {
    name: "xgen_workflow_run",
    description: "워크플로우 실행",
    parameters: {
      type: "object",
      properties: {
        workflow_id: { type: "string" },
        input_data: { type: "string" },
      },
      required: ["workflow_id", "input_data"],
    },
  },
}
```

## 도구 분류

### Core Tools (항상 로드)
| 도구 | 파일 | 설명 |
|------|------|------|
| bash | tools/bash.ts | 쉘 명령 실행 |
| file_read | tools/file-read.ts | 파일 읽기 |
| file_write | tools/file-write.ts | 파일 생성/덮어쓰기 |
| file_edit | tools/file-edit.ts | 파일 부분 수정 |
| grep | tools/grep.ts | 파일 내용 검색 |
| list_files | tools/list-files.ts | 디렉토리 목록 |
| sandbox_run | tools/sandbox.ts | 격리 환경 코드 실행 |

### XGEN Tools (Deferred — 온디맨드 로드)
| 도구 | API 엔드포인트 | 설명 |
|------|---------------|------|
| xgen_workflow_list | GET /api/workflow/list/detail | 워크플로우 목록 |
| xgen_workflow_run | POST /api/workflow/execute/deploy/stream | 워크플로우 실행 |
| xgen_workflow_info | GET /api/workflow/load/{id} | 워크플로우 상세 (노드/엣지) |
| xgen_collection_list | GET /api/retrieval/collections | 컬렉션 목록 |
| xgen_document_list | GET /api/retrieval/documents/list | 문서 목록 |
| xgen_document_upload | POST /api/retrieval/documents/upload | 문서 업로드 |
| xgen_node_list | GET /api/node/get | 노드 목록 (중첩 구조) |
| xgen_node_search | GET /api/node/search | 노드 검색 |
| xgen_node_detail | GET /api/node/detail | 노드 파라미터/포트 |
| xgen_prompt_list | GET /api/prompt/list | 프롬프트 목록 |
| xgen_tool_store | GET /api/tools/store/list | 도구 스토어 |
| xgen_graph_rag_query | POST /graph-rag | GraphRAG 질의 |
| xgen_graph_stats | GET /graph/{id}/stats | 그래프 통계 |
| xgen_mcp_sessions | GET /api/mcp/sessions | MCP 세션 목록 |

### MCP Tools (동적 — 서버 연결 시 로드)
MCP 서버가 제공하는 도구. `mcp_{serverName}_{toolName}` 네이밍.

## 목표: ToolSearch 패턴

```
에이전트: "워크플로우 실행해줘"
  ↓
tool_search("workflow") 호출
  ↓
deferredToolIndex에서 매칭:
  xgen_workflow_list, xgen_workflow_run, xgen_workflow_info 스키마 반환
  ↓
현재 세션의 tools 배열에 추가
  ↓
다음 턴에서 xgen_workflow_run 호출 가능
```

## 도구 실행 흐름

```
LLM → tool_call(name, args)
  ↓
Hooks.preToolUse(name, args) — 검증
  ↓
라우터:
  name.startsWith("xgen_") → xgenExecute(name, args)
  name.startsWith("mcp_")  → mcpManager.callTool(name, args)
  else                      → executeTool(name, args)
  ↓
Hooks.postToolUse(name, result) — 로깅/요약
  ↓
messages에 결과 추가
```

## 도구 결과 구조화

현재: 비정형 문자열 (`"총 5개:\n1. Workflow1\n..."`)
목표: 구조화된 JSON + 요약

```typescript
interface ToolResult {
  summary: string;      // LLM이 읽을 1줄 요약
  data: unknown;        // 구조화된 데이터
  truncated: boolean;   // 잘렸는지
  nextAction?: string;  // 다음 추천 행동
}
```
