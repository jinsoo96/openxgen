# XGEN CLI — 프로젝트 비전

## 개요

XGEN CLI는 XGEN 2.0 플랫폼을 터미널에서 직접 사용할 수 있는 CLI 도구이다.
웹 UI(xgen-frontend) 없이도 워크플로우 실행, 문서 관리, 온톨로지 질의 등
XGEN의 핵심 기능을 커맨드라인에서 수행할 수 있다.

## 핵심 목표

1. **터미널 네이티브 UX** — Gemini CLI 수준의 인터랙티브 경험
2. **XGEN 플랫폼 완전 연동** — 로그인, 워크플로우, 문서, 온톨로지 RAG
3. **개발자 친화적** — Claude Code와 함께 사용 가능, 파이프라인 조합 가능
4. **VS Code Extension** — IDE에서 바로 XGEN 기능 사용

## 주요 기능 (MVP)

### Phase 1: 기반
- [ ] 서버 URL 등록 (`xgen config set-server`)
- [ ] 로그인/로그아웃 (`xgen login` / `xgen logout`)
- [ ] 토큰 관리 (자동 갱신)
- [ ] 프로필 확인 (`xgen whoami`)

### Phase 2: 워크플로우
- [ ] 워크플로우 목록 조회 (`xgen workflow list`)
- [ ] 워크플로우 상세 보기 (`xgen workflow info <id>`)
- [ ] 워크플로우 실행 (`xgen workflow run <id>`)
- [ ] 실행 결과 스트리밍 (실시간 출력)
- [ ] 실행 히스토리 (`xgen workflow history`)

### Phase 3: 인터랙티브 모드
- [ ] 대화형 채팅 모드 (`xgen chat`)
- [ ] 워크플로우 선택 → 바로 실행
- [ ] 멀티턴 대화 지원
- [ ] 리치 출력 (마크다운 렌더링, 코드 하이라이팅)

### Phase 4: 문서 & 온톨로지
- [ ] 문서 업로드 (`xgen doc upload`)
- [ ] 문서 목록 (`xgen doc list`)
- [ ] 온톨로지 질의 (`xgen ontology query "질문"`)
- [ ] GraphRAG 결과 포맷팅

### Phase 5: VS Code Extension
- [ ] XGEN 사이드바 패널
- [ ] 워크플로우 실행 UI
- [ ] 채팅 인터페이스
- [ ] 결과 에디터 통합

## 기술 스택 (후보)

| 영역 | 후보 | 비고 |
|------|------|------|
| 언어 | TypeScript (Node.js) | OpenClaude 참고, npm 배포 용이 |
| CLI 프레임워크 | Commander.js / Ink (React for CLI) | 인터랙티브 UI |
| HTTP 클라이언트 | axios / fetch | XGEN API 호출 |
| 터미널 UI | Ink + React | 리치 렌더링 |
| 인증 저장 | keytar / 파일 기반 | 토큰 안전 보관 |
| 설정 관리 | cosmiconfig | ~/.xgenrc, .xgenrc.json 등 |
| VS Code | vscode API | Extension 개발 |

## 참고 프로젝트

- [OpenClaude](https://github.com/Gitlawb/openclaude) — CLI 구조, VS Code 확장
- Gemini CLI — UX 패턴, 인터랙티브 경험
- Claude Code CLI — 개발자 CLI UX 참고

## XGEN 플랫폼 연동 대상

| 서비스 | 포트 | 용도 |
|--------|------|------|
| xgen-backend-gateway | 8000 | API 진입점 |
| xgen-core | 8001 | 인증, 설정 |
| xgen-workflow | 8002 | 워크플로우 실행 |
| xgen-documents | 8003 | 문서, RAG |
| xgen-mcp-station | 8004 | MCP 서버 |
