# XGEN CLI 아키텍처

## 실행 흐름

```
xgen (입력 없음) → agentRepl() → 에이전트 루프
xgen dash         → startRawTui() → TUI 대시보드
xgen chat         → chat() → 워크플로우 대화
xgen wf/doc/ont   → 커맨드별 직접 API 호출
```

## 에이전트 루프 (현재)

```
사용자 입력
    ↓
buildSystemPrompt() — 하드코딩된 규칙 + 도구 목록 나열
    ↓
streamChat(messages, allTools) — 도구 35개+ 전부 전달
    ↓
Tool Calls 수집 → 실행 → 결과(문자열) messages에 추가
    ↓
반복 (최대 20회) or 도구 호출 없으면 종료
```

## 에이전트 루프 (목표 — 하네스 패턴)

```
사용자 입력
    ↓
시스템 프롬프트 — 인덱스만 제공 (AGENTS.md 스타일)
    ↓
streamChat(messages, coreTools) — 핵심 도구 6개만
    ↓
에이전트가 필요시:
  ├─ tool_search("workflow") → 워크플로우 도구 스키마 로드
  ├─ tool_search("ontology") → 온톨로지 도구 스키마 로드
  ├─ read_index("prompts") → 프롬프트 인덱스 탐색
  └─ spawn_agent("문서 분석") → 서브에이전트 생성
    ↓
Hooks: PreToolUse(검증) → 실행 → PostToolUse(로깅)
    ↓
컨텍스트 한계 → 자동 압축 (오래된 히스토리 요약)
```

## 파일 구조

```
src/
├── agent/
│   ├── llm.ts              LLM 클라이언트 (스트리밍)
│   ├── harness.ts           하네스 — 루프 오케스트레이션 (NEW)
│   ├── context.ts           컨텍스트 관리 + 자동 압축 (NEW)
│   ├── hooks.ts             PreToolUse/PostToolUse (NEW)
│   └── tools/
│       ├── index.ts         도구 레지스트리
│       ├── tool-search.ts   ToolSearch — 온디맨드 도구 로드 (NEW)
│       ├── xgen-api.ts      XGEN 플랫폼 도구 (deferred)
│       ├── bash.ts          쉘 실행
│       ├── file-read.ts     파일 읽기
│       ├── file-write.ts    파일 쓰기
│       ├── file-edit.ts     파일 수정
│       ├── grep.ts          검색
│       ├── list-files.ts    파일 목록
│       └── sandbox.ts       샌드박스 실행
├── api/                     XGEN 플랫폼 API 클라이언트
├── commands/                CLI 커맨드 (agent, chat, wf, doc, ont)
├── config/                  설정 (서버, 인증, 프로바이더)
├── dashboard/               TUI 대시보드
├── mcp/                     MCP 클라이언트
└── docs/                    에이전트 참조 문서 (인덱스)
```

## XGEN 플랫폼 연동

```
xgen-cli ──→ xgen-backend-gateway (Rust, 포트 8000)
                    ├─→ xgen-core (Python, 인증/설정)
                    ├─→ xgen-workflow (Python, 워크플로우/노드/도구/프롬프트)
                    ├─→ xgen-documents (Python, 문서/RAG/온톨로지)
                    └─→ xgen-mcp-station (Python, MCP 세션)
```
