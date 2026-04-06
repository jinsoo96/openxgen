# OPEN XGEN

AI Coding Agent + XGEN Platform CLI.

터미널에서 AI 코딩 에이전트, 워크플로우 실행, 문서 관리, 온톨로지 질의. OpenAI/Gemini/Ollama 등 멀티 프로바이더 지원.

## 설치

```bash
npm install -g openxgen
```

> 권한 오류(`EACCES`) 시: `sudo npm install -g openxgen` 또는 [nvm](https://github.com/nvm-sh/nvm) 사용 권장

## 빠른 시작

### AI 에이전트 모드

```bash
# 프로바이더 설정 (OpenAI, Gemini, Ollama 등)
xgen provider add

# AI 코딩 에이전트 시작
xgen agent

# 또는 바로
xgen
```

### XGEN 플랫폼 모드

```bash
# 서버 연결
xgen config set-server https://xgen.x2bee.com
xgen login

# 워크플로우
xgen wf ls                      # 목록
xgen wf run <id> "질문"         # 실행
xgen chat                       # 대화 모드

# 문서
xgen doc ls                     # 목록
xgen doc upload <file>          # 업로드

# 온톨로지
xgen ont query "질문"           # GraphRAG 질의
xgen ont chat                   # 멀티턴 대화
```

## 커맨드

| 커맨드 | 설명 |
|--------|------|
| `xgen` | 에이전트 또는 채팅 모드 (설정에 따라) |
| `xgen agent` | AI 코딩 에이전트 |
| `xgen provider add/ls/use/remove` | 프로바이더 관리 |
| `xgen chat [id]` | 워크플로우 대화 |
| `xgen wf ls/info/run/history` | 워크플로우 관리 |
| `xgen doc ls/upload/info` | 문서 관리 |
| `xgen ont query/chat/stats` | 온톨로지 질의 |
| `xgen config` | 설정 관리 |
| `xgen login/logout/whoami` | 인증 |

## AI 에이전트 도구

에이전트 모드에서 AI가 사용할 수 있는 도구:

- **file_read** — 파일 읽기
- **file_write** — 파일 생성/덮어쓰기
- **file_edit** — 파일 내 텍스트 교체
- **bash** — 셸 명령어 실행
- **grep** — 파일 내 패턴 검색
- **list_files** — 디렉토리 목록 / glob 검색

## 프로바이더 지원

| 프로바이더 | 타입 | 비고 |
|-----------|------|------|
| OpenAI | `openai` | GPT-4o, GPT-4o-mini 등 |
| Google Gemini | `gemini` | OpenAI 호환 엔드포인트 사용 |
| Ollama | `ollama` | 로컬 모델 (API Key 불필요) |
| Anthropic | `anthropic` | Claude 모델 |
| Custom | `custom` | OpenAI 호환 API 서버 |

## 설정 파일

```
~/.xgen/
├── config.json      # 서버 URL, 테마 등
├── auth.json        # XGEN 로그인 토큰
└── providers.json   # AI 프로바이더 설정
```

## 개발

```bash
git clone <repo>
cd xgen-cli
npm install
npm run build
npm run dev     # watch 모드
```

## License

MIT
