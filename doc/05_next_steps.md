# XGEN CLI 다음 단계

## 즉시 해야 할 것

### 1. 실제 서버 연동 테스트
- Docker Compose dev 환경 실행 후 로컬 테스트
- 로그인 → 워크플로우 목록 → 실행 → 스트리밍 결과 확인
- SSE 파서가 실제 응답 형식과 맞는지 검증

### 2. npm link 테스트
```bash
npm link
xgen --version
xgen config set-server http://localhost:8000
xgen login
xgen wf ls
xgen wf run <id> "안녕하세요"
xgen chat
```

### 3. 마크다운 렌더링 추가
- `marked` + `marked-terminal` 로 응답 마크다운 렌더링
- 코드 블록 하이라이팅 (`cli-highlight`)
- 테이블 포맷팅

---

## 단기 로드맵

### 문서 API 연동
- xgen-documents의 엔드포인트 조사
- 문서 업로드 (multipart/form-data)
- 문서 목록 조회

### 온톨로지 질의
- `/graph-rag` 엔드포인트 연동
- `/graph-rag/multi-turn` 멀티턴 지원
- 결과 포맷팅 (Sources, SCS Context, Triples)

### UX 개선
- Ink (React for CLI) 기반 리치 UI
  - 워크플로우 선택: 화살표 키 네비게이션
  - 실행 중: 진행률 표시 + 노드 상태 시각화
  - 응답: 마크다운 + 코드 하이라이팅
- Tab 자동완성
- --json 플래그 (스크립트 연동용)

---

## 중기 로드맵

### VS Code Extension
- OpenClaude의 vscode-extension 참고
- XGEN 사이드바: 워크플로우 목록, 실행 UI
- 에디터 내 채팅 패널
- 실행 결과 → 에디터에 삽입

### 배포 파이프라인
- `xgen deploy <workflow-id>` — 배포 상태 변경
- `xgen deploy status <workflow-id>` — 배포 상태 확인
- `xgen deploy key <workflow-name>` — 배포 키 조회

### 관리자 기능
- `xgen admin users` — 사용자 관리
- `xgen admin workflows` — 워크플로우 모니터링
- `xgen admin logs` — 시스템 로그

---

## 장기 비전

### Gemini CLI 수준 UX
- 풀스크린 TUI (Terminal UI)
- 멀티 패널 레이아웃
- 스트리밍 + 도구 호출 시각화
- 테마 시스템

### Claude Code 연동
- MCP 서버로 XGEN 도구 노출
- Claude Code 안에서 `xgen workflow run` 직접 호출
- 워크플로우 결과를 Claude Code 컨텍스트에 자동 주입

### npm 패키지 배포
- `npm install -g @xgen/cli`
- 버전 관리 + 자동 업데이트 알림
