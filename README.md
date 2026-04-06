# OPEN XGEN

터미널에서 모든 걸 하는 AI 에이전트. XGEN 플랫폼 + 코딩을 채팅 하나로.

```
────────────────────────────────────────────────────────────
  ✦ OPEN XGEN
────────────────────────────────────────────────────────────

  model  gpt-4.1
  xgen   ● admin@xgen.x2bee.com
  cwd    ~/project

  무엇이든 물어보세요. /help

  ❯ 워크플로우 보여줘
  ┌ xgen_workflow_list()
  └ 1. Jeju_test…

  ❯ 6번 실행해줘
  ┌ xgen_workflow_run(...)
  └ 결과: ...
```

## 설치

```bash
npm install -g openxgen
```

> 권한 오류 시: `sudo npm install -g openxgen`

## 시작

```bash
xgen
```

끝. 처음 실행하면 프로바이더(OpenAI, Gemini, Ollama 등) 설정 가이드가 나옵니다.

## 채팅으로 전부 가능

```
❯ 워크플로우 목록            → 워크플로우 53개 표시
❯ 6번 실행 "안녕하세요"      → 바로 실행
❯ 컬렉션 뭐 있어            → 문서 컬렉션 22개 표시
❯ 이 폴더 파일 보여줘        → 현재 디렉토리 파일 목록
❯ main.py 읽어줘             → 파일 내용 표시
❯ Python fibonacci 만들어줘  → 코드 생성 + 파일 저장
❯ npm test 실행              → 셸 명령어 실행
```

## 슬래시 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/connect` | XGEN 서버 연결 (본사/제주/롯데몰 프리셋) |
| `/env` | 환경 전환 |
| `/provider` | AI 프로바이더 변경 |
| `/dashboard` | TUI 대시보드 (4분할 화면) |
| `/tools` | 사용 가능한 도구 목록 |
| `/status` | 현재 연결 상태 |
| `/clear` | 대화 초기화 |
| `/help` | 도움말 |

## AI 도구

### 코딩
`file_read` `file_write` `file_edit` `bash` `grep` `list_files` `sandbox_run`

### XGEN 플랫폼
`xgen_workflow_list` `xgen_workflow_run` `xgen_workflow_info` `xgen_collection_list` `xgen_execution_history` `xgen_server_status`

### MCP
`.mcp.json` 설정 시 MCP 서버 도구 자동 연동

## 프로바이더

| 프로바이더 | 모델 |
|-----------|------|
| OpenAI | gpt-4o, gpt-4.1, gpt-4o-mini, o3-mini |
| Google Gemini | gemini-2.5-pro, gemini-2.0-flash |
| Anthropic | claude-opus-4, claude-sonnet-4 |
| Ollama | llama3.1, codellama, qwen2.5-coder |
| Groq | llama-3.3-70b, mixtral-8x7b |
| Together AI | Meta-Llama-3.1-70B |
| OpenRouter | 멀티 모델 |
| DeepSeek | deepseek-chat, deepseek-coder |
| Custom | OpenAI 호환 서버 |

## 설정 파일

```
~/.xgen/
├── config.json        서버 URL
├── auth.json          로그인 토큰
├── providers.json     AI 프로바이더
└── environments.json  서버 환경 프로필
```

## 개발

```bash
git clone https://github.com/jinsoo96/openxgen.git
cd openxgen
npm install
npm run build
npm run dev     # watch 모드
```

## License

MIT
