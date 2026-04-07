# Progressive Disclosure 적용 전략

## 핵심 원리

> 에이전트에게 모든 정보를 주지 않는다.
> 인덱스만 주고, 도구로 탐색하게 한다.
> 환경과 구조만 제공하면 에이전트가 알아서 개선된다.

## 참고 패턴

| 출처 | 패턴 | 적용 |
|------|------|------|
| Claude Code | Deferred Tools — 이름만 로드, ToolSearch로 스키마 온디맨드 | tool_search 도구 |
| Claude Code | System Reminder — N턴마다 상태 주입 | 컨텍스트 리마인더 |
| Claude Code | CLAUDE.md → SKILL.md 계층 | 시스템 프롬프트 계층화 |
| OpenAI | AGENTS.md 인덱스 → docs/ 포인터 | 프롬프트 인덱스 |
| Anthropic | 3에이전트 (Planner→Generator→Evaluator) | 서브에이전트 분리 |

## 정보 계층

```
Level 0: 핵심 규칙 (시스템 프롬프트 — 항상 로드)
  - "도구를 바로 실행해라, 물어보지 마라"
  - "한국어 매칭"
  - 서버 연결 상태

Level 1: 도구 인덱스 (시스템 프롬프트 — 이름만)
  - "workflow: 워크플로우 관리"
  - "graph: 온톨로지 질의"
  - tool_search로 상세 스키마 로드

Level 2: 도구 스키마 (온디맨드 — tool_search 결과)
  - xgen_workflow_run의 파라미터, 설명
  - 호출 후 현재 세션에 추가

Level 3: XGEN 플랫폼 데이터 (도구 실행 결과)
  - 워크플로우 목록, 노드 상세, 문서 내용
  - 에이전트가 결과를 해석하고 다음 행동 결정
```

## 도구 카테고리별 로딩 전략

| 카테고리 | 도구 수 | 로딩 | 조건 |
|----------|---------|------|------|
| core (bash, file, grep) | 6 | 항상 | - |
| tool_search | 1 | 항상 | - |
| xgen_workflow_* | 7 | 온디맨드 | XGEN 연결 시 |
| xgen_collection_* | 3 | 온디맨드 | XGEN 연결 시 |
| xgen_node_* | 3 | 온디맨드 | XGEN 연결 시 |
| xgen_prompt_* | 1 | 온디맨드 | XGEN 연결 시 |
| xgen_tool_* | 2 | 온디맨드 | XGEN 연결 시 |
| xgen_graph_* | 2 | 온디맨드 | XGEN 연결 시 |
| xgen_mcp_* | 1 | 온디맨드 | XGEN 연결 시 |
| mcp_* | N | 온디맨드 | MCP 서버 연결 시 |

## 프롬프트 탐색

현재: 시스템 프롬프트에 모든 규칙 하드코딩
목표: 에이전트가 프롬프트 인덱스를 보고 필요한 프롬프트를 스스로 선택

```
프롬프트 인덱스:
  coding: 코드 생성/수정 시 적용할 규칙
  workflow: 워크플로우 실행 시 입력 형식 가이드
  ontology: 온톨로지 질의 시 SPARQL 생성 규칙
  document: 문서 검색 시 RAG 활용 전략

에이전트가 "온톨로지 질의해줘" → read_prompt_index("ontology") 
→ 온톨로지 관련 프롬프트 로드 → 질의에 활용
```

## 샌드박스와 인터프리터

환경만 줘도 에이전트가 알아서 한다:
- bash 도구 = 인터프리터 환경
- sandbox_run = 격리된 코드 실행 환경
- XGEN API = 플랫폼 조작 환경

노드를 연결하는 것이 아니라, **에이전트에게 환경을 주고 스스로 조합하게** 한다.
