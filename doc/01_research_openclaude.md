# OpenClaude 조사 결과

## 프로젝트 개요
- **이름**: @gitlawb/openclaude
- **설명**: Claude Code를 오픈소스로 열어 OpenAI, Gemini, DeepSeek, Ollama 등 200+ 모델 지원
- **언어**: TypeScript (Bun 기반 빌드, Node.js 런타임)
- **설치**: `npm install -g @gitlawb/openclaude`
- **실행**: `openclaude`

## 프로젝트 구조

```
openclaude/
├── bin/openclaude              # CLI 엔트리포인트 (shebang)
├── dist/cli.mjs               # 빌드된 번들
├── src/
│   ├── commands/               # 슬래시 커맨드 (/provider, /branch 등)
│   ├── cli/
│   │   ├── handlers/           # CLI 핸들러 (auth, agents, mcp)
│   │   ├── transports/         # SSE, WebSocket, HybridTransport
│   │   ├── print.ts            # 출력 유틸리티
│   │   └── exit.ts
│   ├── tools/                  # 도구들 (AgentTool, BashTool, FileReadTool 등)
│   ├── bridge/                 # 원격 연결 (JWT, WebSocket 브릿지)
│   ├── services/api/           # API 통신 레이어
│   ├── utils/                  # 공통 유틸리티
│   ├── constants/prompts.ts    # 시스템 프롬프트
│   ├── commands.ts             # 커맨드 레지스트리
│   ├── QueryEngine.ts          # 쿼리 엔진
│   └── Task.ts                 # 태스크 관리
├── scripts/
│   ├── build.ts                # Bun 빌드 스크립트
│   ├── provider-launch.ts      # 프로바이더별 실행
│   ├── provider-discovery.ts   # 프로바이더 자동 감지
│   └── provider-bootstrap.ts   # 프로바이더 초기 설정
├── python/                     # Python 프로바이더 (Ollama, Atomic Chat)
├── vscode-extension/           # VS Code 확장
│   └── openclaude-vscode/
│       ├── src/extension.js    # VS Code 확장 진입점
│       ├── src/state.js        # 상태 관리
│       ├── src/presentation.js # UI 렌더링
│       └── themes/             # 터미널 테마
└── package.json
```

## 핵심 기술 스택

| 영역 | 기술 |
|------|------|
| 런타임 | Node.js 20+ |
| 빌드 | Bun (bun:bundle) |
| UI | React 19 + react-reconciler (Ink 스타일 CLI 렌더링) |
| CLI 파싱 | Commander.js |
| HTTP | axios, undici |
| WebSocket | ws |
| 터미널 | chalk, cli-highlight, marked, wrap-ansi |
| 검증 | zod |
| 설정 | yaml, jsonc-parser |
| 검색 | fuse.js (퍼지 검색) |

## 주요 패턴

### 1. Provider 시스템
- 환경변수 또는 `/provider` 슬래시 커맨드로 설정
- `.openclaude-profile.json`에 프로필 저장
- settings.json의 `agentModels`로 에이전트별 모델 라우팅

### 2. CLI UX
- React 기반 터미널 렌더링 (Ink 패턴)
- SSE 스트리밍 출력
- 슬래시 커맨드 시스템 (`/provider`, `/branch`, `/agents` 등)
- 도구 호출 + 스트리밍 응답 루프

### 3. VS Code Extension
- `extension.js` — 활성화/비활성화
- `state.js` — 프로바이더 상태 관리
- `presentation.js` — UI 렌더링
- 터미널 통합 (launch integration)
- 커스텀 테마 지원

## XGEN CLI에 적용할 점

1. **프로바이더 대신 서버 연결** — XGEN 서버 URL 등록/관리
2. **슬래시 커맨드** — `/workflow`, `/doc`, `/ontology` 등 XGEN 전용 커맨드
3. **SSE 스트리밍** — 워크플로우 실행 결과 실시간 스트리밍 (XGEN은 이미 SSE 지원)
4. **React CLI 렌더링** — 리치 출력 (마크다운, 코드 하이라이트)
5. **VS Code Extension** — XGEN 사이드바, 워크플로우 실행 UI
