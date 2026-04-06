# OPEN XGEN 다음 단계

## 즉시

### XGEN API 전체 연동
- 게이트웨이 300개+ 엔드포인트 중 주요 API 도구화
- admin: 사용자 관리, 그룹, 시스템 모니터링
- tools: 도구 스토어, CLI 스킬
- prompts: 프롬프트 관리/스토어
- nodes: 노드 카테고리, 파라미터
- workflow: 스케줄, 배치, 트레이스, 자동 생성

### 온톨로지 연동
- xgen-infra 게이트웨이 `services.yaml`에 ontology 모듈 추가 필요
- 추가 후: graph-rag 질의, 멀티턴, 그래프 통계 연동

### 워크플로우 실행 개선
- 비배포 워크플로우도 실행 가능하게 (tester 엔드포인트 활용)
- SSE 스트리밍 — Istio frontendRoutes 수정하거나 게이트웨이 직접 접근 경로 확보

---

## 단기

### UX 개선
- 마크다운 렌더링 (코드 하이라이팅, 테이블)
- 도구 실행 결과 접힘/펼침 (OpenClaude 스타일)
- 비용/토큰 사용량 표시
- 대화 이력 저장/복원

### CI/CD
- xgen-infra 소스 변경 감지 → CLI 자동 빌드/배포
- GitLab webhook → npm publish 자동화
- 버전 관리 + 자동 업데이트 알림

---

## 중기

### VS Code Extension
- XGEN 사이드바 (워크플로우, 문서, 컬렉션)
- 에디터 내 AI 채팅 패널
- 워크플로우 실행 결과 → 에디터 삽입

### 고급 기능
- 멀티턴 워크플로우 실행 (컨텍스트 유지)
- 워크플로우 빌더 (CLI에서 노드 추가/연결)
- 배포 관리 (`xgen deploy`)
- 관리자 대시보드 (사용자/권한/로그)

---

## 장기

### 풀스크린 TUI
- Gemini CLI 수준 터미널 UI
- 멀티 패널 + 스트리밍 시각화
- 테마 시스템

### Claude Code 연동
- MCP 서버로 XGEN 도구 노출
- Claude Code 안에서 XGEN 기능 직접 호출

### 배포
- `npm install -g openxgen` 안정화
- 자동 업데이트
- 플러그인 시스템
