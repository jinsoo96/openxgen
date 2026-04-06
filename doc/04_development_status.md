# XGEN CLI 개발 현황

## Phase 1: 기반 (MVP) — ✅ 완료

### 구현된 기능

#### 설정 관리
- [x] `xgen config set-server <url>` — 서버 URL 설정
- [x] `xgen config get-server` — 현재 서버 확인
- [x] `xgen config list` — 전체 설정 조회
- [x] `xgen config set <key> <value>` — 설정 변경
- [x] `~/.xgen/config.json` 자동 생성/관리

#### 인증
- [x] `xgen login` — 이메일/비밀번호 로그인 (인터랙티브 + 옵션)
- [x] `xgen logout` — 로그아웃
- [x] `xgen whoami` — 현재 사용자 정보 + 토큰 유효성 검증
- [x] 토큰 자동 갱신 (401 응답 시 refresh_token으로 재시도)
- [x] `~/.xgen/auth.json` 보안 저장 (600 권한)

#### API 클라이언트
- [x] axios 인스턴스 + 인터셉터
- [x] 자동 Authorization 헤더
- [x] 401 → 자동 토큰 갱신
- [x] 서버 변경 시 클라이언트 리셋

### 구현된 파일
```
src/
├── index.ts                     # 메인 CLI (Commander)
├── commands/
│   ├── config.ts                # config 서브커맨드
│   ├── login.ts                 # login, logout, whoami
│   ├── chat.ts                  # 대화형 모드
│   └── workflow/
│       ├── index.ts             # workflow 서브커맨드 그룹
│       ├── list.ts              # workflow list
│       ├── info.ts              # workflow info
│       ├── run.ts               # workflow run (SSE 스트리밍)
│       └── history.ts           # workflow history
├── api/
│   ├── client.ts                # axios 클라이언트
│   ├── auth.ts                  # 인증 API
│   ├── workflow.ts              # 워크플로우 API
│   └── types.ts                 # 공통 타입
├── config/
│   └── store.ts                 # 설정/인증 저장소
└── utils/
    ├── sse.ts                   # SSE 파서
    └── format.ts                # 출력 포맷팅
```

---

## Phase 2: 워크플로우 — ✅ 완료

- [x] `xgen workflow list` (별칭: `xgen wf ls`)
- [x] `xgen workflow list --detail`
- [x] `xgen workflow info <id>`
- [x] `xgen workflow run <id> "입력"` — SSE 스트리밍 실행
- [x] `xgen workflow run -i <id>` — 인터랙티브 입력
- [x] `xgen workflow run -l <id>` — 디버그 로그 표시
- [x] `xgen workflow history [id]` — 실행 이력

---

## Phase 3: 인터랙티브 모드 — ✅ 기본 구현

- [x] `xgen chat` — 워크플로우 선택 → 반복 실행
- [x] `xgen chat <workflow-id>` — 특정 워크플로우로 바로 시작
- [x] 실시간 SSE 스트리밍 응답
- [ ] 멀티턴 컨텍스트 유지 (서버 사이드 지원 필요)
- [ ] 마크다운 렌더링 (marked-terminal)
- [ ] 코드 하이라이팅

---

## Phase 4: 문서 & 온톨로지 — ✅ 구현 완료

- [x] `xgen doc list` (별칭: `xgen doc ls`)
- [x] `xgen doc upload <file>`
- [x] `xgen doc info <id>`
- [x] `xgen ontology query "질문"` (별칭: `xgen ont q`)
- [x] `xgen ont chat` — 멀티턴 GraphRAG
- [x] `xgen ont stats <graph-id>`

---

## Phase 5: AI 코딩 에이전트 — ✅ 구현 완료

- [x] `xgen provider add/ls/use/remove` — 멀티 프로바이더 관리
- [x] `xgen agent` — AI 코딩 에이전트 REPL
- [x] 도구: file_read, file_write, file_edit, bash, grep, list_files
- [x] 스트리밍 응답 + 멀티 스텝 tool calling 루프
- [x] OpenAI/Gemini/Ollama/Anthropic/Custom 프로바이더 지원
- [x] 슬래시 커맨드: /clear, /tools, /provider, /exit

---

## Phase 6: VS Code Extension — 🔲 미구현

- [ ] 프로젝트 초기화
- [ ] XGEN 사이드바
- [ ] 워크플로우 실행 UI
- [ ] 채팅 인터페이스

---

## 빌드 & 실행

```bash
# 의존성 설치
npm install

# 빌드
npm run build

# 전역 링크 (개발용)
npm link

# 또는 직접 실행
node dist/index.js [command]
```

## 확인된 이슈

1. **비밀번호 해싱**: 게이트웨이(Rust)에서 SHA256 해싱 후 DB 비교. 
   CLI에서 평문 전송 → 게이트웨이가 해싱 → DB 비교하는 구조이므로 문제없음.
2. **SSE 파싱**: 실제 서버 응답 형식에 맞게 파서 튜닝 필요할 수 있음.
3. **로컬 개발**: Docker Compose dev 환경에서 테스트 필요.
