# OPEN XGEN 개발 현황 (v1.3.3)

## Phase 1: 기반 (MVP) — ✅ 완료

- [x] 설정 관리 (`xgen config set-server/get-server/list/set`)
- [x] 인증 (`xgen login/logout/whoami`) — SHA256 해싱
- [x] API 클라이언트 (axios + 토큰 자동 갱신)

## Phase 2: 워크플로우 — ✅ 완료

- [x] `xgen wf ls` / `xgen wf ls --detail`
- [x] `xgen wf info <id>` / `xgen wf run <id> "입력"`
- [x] SSE 스트리밍 실행 / 디버그 로그 / 실행 이력

## Phase 3: 인터랙티브 채팅 — ✅ 완료

- [x] `xgen chat` — 워크플로우 채팅
- [x] SSE 스트리밍 응답

## Phase 4: 문서 & 온톨로지 — ✅ 부분 완료

- [x] 컬렉션 목록 (`/api/retrieval/collections`) — 22개 조회 확인
- [x] 문서 업로드/조회
- [ ] 온톨로지 — 게이트웨이에 ontology 모듈 매핑 없어 접근 불가 (인프라 수정 필요)

## Phase 5: AI 코딩 에이전트 — ✅ 완료

- [x] Claude Code 스타일 채팅 기본 진입 (`xgen` → 바로 채팅)
- [x] 프로바이더 9종 (OpenAI/Gemini/Anthropic/Ollama/Groq/Together/OpenRouter/DeepSeek/Custom)
- [x] 모델 50개+ 선택지 + 환경변수 자동감지
- [x] 내장 도구 7개: file_read/write/edit, bash, grep, list_files, sandbox_run
- [x] XGEN 도구 6개: workflow_list/run/info, collection_list, execution_history, server_status
- [x] MCP 클라이언트 (.mcp.json 자동 연동)
- [x] 스트리밍 + 멀티스텝 tool calling (최대 20회)
- [x] 슬래시 커맨드: /connect, /env, /provider, /dashboard, /tools, /status, /clear, /help, /exit

## Phase 6: 환경 & 서버 — ✅ 완료

- [x] 환경 프로필 (본사/제주/롯데몰 프리셋)
- [x] /connect로 서버 연결 + 로그인 한번에
- [x] /env로 환경 전환

## Phase 7: TUI 대시보드 — ✅ 완료

- [x] blessed 기반 4분할: 워크플로우 | 상세/실행 | 컬렉션 | AI 채팅
- [x] Tab 패널 전환, 화살표 선택, Enter 실행
- [x] 30초 자동 새로고침
- [x] /dashboard 커맨드로 진입

## Phase 8: npm 배포 — ✅ 완료

- [x] `npm install -g openxgen` → `xgen` 전역 명령어
- [x] https://www.npmjs.com/package/openxgen
- [x] https://github.com/jinsoo96/openxgen

## Phase 9: VS Code Extension — 🔲 미구현

- [ ] XGEN 사이드바
- [ ] 워크플로우 실행 UI
- [ ] 채팅 인터페이스

---

## 현재 소스 구조

```
src/
├── index.ts                        메인 엔트리
├── commands/
│   ├── agent.ts                    AI 에이전트 REPL (메인 인터페이스)
│   ├── provider.ts                 프로바이더 9종 가이드 설정
│   ├── home.ts                     홈 메뉴
│   ├── chat.ts                     워크플로우 채팅
│   ├── config.ts                   설정 관리
│   ├── login.ts                    인증
│   ├── doc.ts                      문서 관리
│   ├── ontology.ts                 온톨로지
│   └── workflow/                   워크플로우 CRUD + 실행
├── agent/
│   ├── llm.ts                      OpenAI SDK 멀티 프로바이더
│   └── tools/
│       ├── index.ts                도구 레지스트리
│       ├── xgen-api.ts             XGEN 플랫폼 도구 (6개)
│       ├── file-read/write/edit.ts 파일 도구
│       ├── bash.ts                 셸 실행
│       ├── grep.ts                 검색
│       ├── list-files.ts           디렉토리
│       └── sandbox.ts              격리 코드 실행
├── api/
│   ├── client.ts                   axios + 토큰 갱신
│   ├── auth.ts                     인증 (SHA256)
│   ├── workflow.ts                 워크플로우 API
│   ├── document.ts                 문서/컬렉션 API
│   └── ontology.ts                 온톨로지 API
├── mcp/
│   └── client.ts                   MCP stdio 클라이언트
├── config/
│   └── store.ts                    설정/인증/프로바이더/환경 저장소
├── dashboard/
│   ├── tui.ts                      blessed 4분할 대시보드
│   └── renderer.ts                 TUI 렌더링
└── utils/
    ├── ui.ts                       UI 컴포넌트
    ├── format.ts                   출력 포맷
    ├── sse.ts                      SSE 파서
    └── markdown.ts                 마크다운 렌더링
```

---

## 확인된 이슈

1. **워크플로우 실행 404**: Istio가 `/api/workflow/execute/based_id/stream`을 Next.js로 라우팅 → CLI 직접 접근 불가. deploy/result 엔드포인트로 우회 중.
2. **온톨로지 접근 불가**: 게이트웨이 services.yaml에 `ontology` 모듈 매핑 없음.
3. **비배포 워크플로우 실행 불가**: deploy_key 없으면 실행 안 됨.

## 다음 할 것

- XGEN API 전체 엔드포인트 연동 (admin, tools, prompts, nodes 등)
- 게이트웨이에 ontology 모듈 추가
- xgen-infra 소스 변경 감지 → 자동 빌드
- VS Code Extension
