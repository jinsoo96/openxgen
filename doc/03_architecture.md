# XGEN CLI 아키텍처 설계

## 기술 스택 결정

| 영역 | 선택 | 이유 |
|------|------|------|
| 언어 | TypeScript | OpenClaude 참고, npm 배포 용이, 타입 안전성 |
| 런타임 | Node.js 20+ | 범용성, 안정성 |
| 빌드 | tsup (esbuild) | 빠른 번들링, ESM 지원 |
| CLI 프레임워크 | Commander.js | 업계 표준, 서브커맨드 지원 |
| 터미널 UI | Ink (React for CLI) | 리치 인터랙티브 UI, 스피너, 테이블 |
| HTTP | axios | 인터셉터로 토큰 자동 갱신 |
| 인증 저장 | conf (파일 기반) | ~/.xgen/config.json에 토큰/설정 저장 |
| 마크다운 | marked + chalk | 터미널 마크다운 렌더링 |
| 코드 하이라이트 | cli-highlight | 코드 블록 하이라이팅 |
| 스피너 | ora | 로딩 인디케이터 |
| 프롬프트 | @inquirer/prompts | 인터랙티브 입력 |

## 디렉토리 구조

```
xgen-cli/
├── bin/
│   └── xgen                    # CLI 엔트리포인트 (#!/usr/bin/env node)
├── src/
│   ├── index.ts                # 메인 CLI 정의 (Commander)
│   ├── commands/               # 커맨드 모듈
│   │   ├── login.ts            # xgen login
│   │   ├── logout.ts           # xgen logout
│   │   ├── config.ts           # xgen config
│   │   ├── whoami.ts           # xgen whoami
│   │   ├── workflow/
│   │   │   ├── list.ts         # xgen workflow list
│   │   │   ├── info.ts         # xgen workflow info <id>
│   │   │   ├── run.ts          # xgen workflow run <id>
│   │   │   └── history.ts      # xgen workflow history
│   │   ├── chat.ts             # xgen chat (인터랙티브 모드)
│   │   ├── doc/
│   │   │   ├── list.ts         # xgen doc list
│   │   │   └── upload.ts       # xgen doc upload
│   │   └── ontology/
│   │       └── query.ts        # xgen ontology query
│   ├── api/                    # API 클라이언트
│   │   ├── client.ts           # axios 인스턴스 (인터셉터, 토큰 갱신)
│   │   ├── auth.ts             # 인증 API
│   │   ├── workflow.ts         # 워크플로우 API
│   │   ├── document.ts         # 문서 API
│   │   └── types.ts            # API 타입 정의
│   ├── config/
│   │   └── store.ts            # 설정 저장/로드 (~/.xgen/)
│   ├── ui/                     # Ink 컴포넌트
│   │   ├── Spinner.tsx         # 로딩 스피너
│   │   ├── StreamOutput.tsx    # SSE 스트리밍 출력
│   │   ├── WorkflowSelect.tsx  # 워크플로우 선택 UI
│   │   ├── ChatInterface.tsx   # 채팅 인터페이스
│   │   └── Theme.ts            # 색상 테마
│   └── utils/
│       ├── markdown.ts         # 마크다운 렌더링
│       ├── sse.ts              # SSE 파서
│       └── format.ts           # 출력 포맷팅
├── doc/                        # 개발 문서
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## CLI 커맨드 트리

```
xgen
├── login                       # 서버 로그인
├── logout                      # 로그아웃
├── whoami                      # 현재 사용자 정보
├── config
│   ├── set-server <url>        # 서버 URL 설정
│   ├── get-server              # 현재 서버 URL
│   └── list                    # 전체 설정 조회
├── workflow
│   ├── list                    # 워크플로우 목록
│   ├── info <id>               # 워크플로우 상세
│   ├── run <id> [input]        # 워크플로우 실행
│   ├── run -i <id>             # 인터랙티브 실행
│   └── history [id]            # 실행 이력
├── chat [workflow-id]          # 대화형 모드
├── doc
│   ├── list                    # 문서 목록
│   └── upload <file>           # 문서 업로드
└── ontology
    └── query <question>        # 온톨로지 질의
```

## 인증 플로우

```
1. xgen config set-server https://xgen.x2bee.com
   → ~/.xgen/config.json에 서버 URL 저장

2. xgen login
   → 이메일/비밀번호 프롬프트
   → POST /api/auth/login
   → access_token, refresh_token을 ~/.xgen/auth.json에 저장

3. 이후 모든 API 호출
   → Authorization: Bearer {access_token} 헤더 자동 추가
   → 401 응답 시 → refresh_token으로 자동 갱신
   → 갱신 실패 시 → "세션 만료. xgen login 실행하세요" 출력
```

## SSE 스트리밍 처리

```
POST /api/workflow/execute/based_id/stream
→ Content-Type: text/event-stream

이벤트 종류:
- data: {"type": "token", "content": "답변 텍스트..."} → 실시간 출력
- data: {"type": "log", "content": "..."} → 디버그 로그
- data: {"type": "node_status", ...} → 노드 실행 상태 표시
- data: {"type": "tool", ...} → 도구 호출 정보
- data: {"type": "complete", ...} → 실행 완료
- data: {"type": "error", ...} → 에러 처리
```

## 설정 파일 구조

```
~/.xgen/
├── config.json     # 서버 URL, 기본 설정
│   {
│     "server": "https://xgen.x2bee.com",
│     "defaultWorkflow": null,
│     "theme": "default",
│     "streamLogs": false
│   }
├── auth.json       # 인증 정보 (600 권한)
│   {
│     "accessToken": "jwt...",
│     "refreshToken": "jwt...",
│     "userId": "1",
│     "username": "admin",
│     "expiresAt": "2026-04-07T..."
│   }
└── history/        # 실행 이력 캐시
```
