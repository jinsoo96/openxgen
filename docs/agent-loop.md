# 에이전트 루프 상세

## 현재 구현 — `src/commands/agent.ts`

### 루프 구조

```typescript
// 1. 시스템 프롬프트 빌드 (하드코딩)
const messages = [{ role: "system", content: buildSystemPrompt() }];

// 2. REPL
while (true) {
  const input = await askUser();
  messages.push({ role: "user", content: input });
  await runLoop(client, model, messages, allTools);  // 도구 35개 전부
}

// 3. Tool Calling 루프
async function runLoop(client, model, messages, tools) {
  for (let i = 0; i < 20; i++) {
    const result = await streamChat(client, model, messages, tools);
    if (result.toolCalls.length === 0) return;  // 종료 조건
    for (const tc of result.toolCalls) {
      const result = await executeTool(tc);      // 실행
      messages.push({ role: "tool", content: result.slice(0, 8000) });
    }
  }
}
```

### 문제점
1. `allTools` = 기본 7 + XGEN 28 + MCP N개 → 매 호출마다 전부 전달
2. `buildSystemPrompt()`에 도구 목록 수동 나열 → 동기화 지옥
3. 결과 8000자 truncation → 정보 손실, 페이지네이션 없음
4. 컨텍스트 무한 증가 → 압축 없음

## 목표 구현 — 하네스 패턴

### 핵심 도구만 전달 (Progressive Disclosure)

```typescript
// Core Tools — 항상 로드 (6개)
const coreTools = [
  bash,           // 쉘 실행
  file_read,      // 파일 읽기
  file_write,     // 파일 쓰기
  file_edit,      // 파일 수정
  grep,           // 검색
  tool_search,    // 도구 탐색 — 에이전트가 필요한 도구를 스스로 찾음
];

// Deferred Tools — 이름만 시스템 프롬프트에 노출
// 에이전트가 tool_search("workflow")하면 그때 스키마 로드
const deferredToolIndex = {
  "xgen_workflow_*": "워크플로우 관리 (목록, 실행, 정보, 성능)",
  "xgen_collection_*": "컬렉션/문서 관리",
  "xgen_node_*": "노드 탐색 (목록, 검색, 상세)",
  "xgen_prompt_*": "프롬프트 CRUD",
  "xgen_tool_*": "도구 스토어 관리",
  "xgen_graph_*": "온톨로지 GraphRAG 질의",
  "xgen_mcp_*": "MCP 세션 관리",
  "mcp_*": "MCP 서버 도구 (동적)",
};
```

### ToolSearch 도구

```typescript
// 에이전트가 "워크플로우 실행해줘" → tool_search("workflow") 호출
// → xgen_workflow_list, xgen_workflow_run 등의 스키마가 로드됨
// → 다음 턴에서 실제 도구 호출 가능

function tool_search(query: string): ToolDefinition[] {
  // 1. deferredToolIndex에서 매칭
  // 2. 매칭된 도구의 전체 스키마 반환
  // 3. 반환된 도구를 현재 세션의 tools에 추가
}
```

### 시스템 프롬프트 — 인덱스 기반

```
You are OPEN XGEN. You have core tools (bash, file_read, file_write, file_edit, grep).

Additional tool categories are available via tool_search:
- workflow: 워크플로우 관리
- collection: 컬렉션/문서
- node: 노드 탐색
- prompt: 프롬프트
- tool: 도구 스토어
- graph: 온톨로지
- mcp: MCP 세션

Call tool_search("category") to load tools on demand.
Do not ask — just search and execute.
```

### Hooks

```typescript
// 도구 실행 전 — 검증/로깅
preToolUse(toolName, args) {
  if (toolName.startsWith("xgen_") && !isConnected()) {
    return { blocked: true, reason: "XGEN 미연결" };
  }
  log(`[${timestamp}] ${toolName}(${JSON.stringify(args)})`);
}

// 도구 실행 후 — 결과 검증
postToolUse(toolName, result) {
  if (result.length > 8000) {
    return summarize(result);  // 자동 요약
  }
}
```

### 컨텍스트 압축

```typescript
// 메시지 수가 threshold 초과 시
if (messages.length > 30) {
  const summary = await compactMessages(messages.slice(1, -10));
  messages = [
    messages[0],                    // system prompt
    { role: "system", content: `이전 대화 요약: ${summary}` },
    ...messages.slice(-10),         // 최근 10개만 유지
  ];
}
```
