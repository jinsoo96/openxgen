# OPEN XGEN CLI

A terminal-based AI coding agent and XGEN platform CLI. Chat-first interface inspired by Claude Code — talk to your AI, manage workflows, query knowledge graphs, and handle documents, all from the terminal.

## Install

```bash
npm install -g openxgen
```

## Quick Start

```bash
xgen                    # AI 코딩 에이전트 (기본)
xgen dash               # TUI 대시보드
xgen chat               # 워크플로우 대화
xgen wf ls              # 워크플로우 목록
```

On first run, you'll be guided through provider setup (OpenAI, Gemini, Anthropic, Ollama, etc.).

## TUI Dashboard (`xgen dash`)

6-tab interactive dashboard with real-time XGEN platform management.

```
 OPEN XGEN v2.4 admin@xgen.x2bee.com │  1:워크플로우   2:컬렉션   3:노드   4:프롬프트   5:도구   6:MCP
──────────────────────────────────────┬─────────────────────────────────────
▸  1. ● Workflow (6)                 │ Workflow (6)
   2. ● Mumu                        │
   3. ○ 플래티어 문서검색             │ ID    workflow_019d...
                                     │ 배포  ● Yes
                                     │
                                     │ Enter 노드구조  i 실행
──────────────────────────────────────┴─────────────────────────────────────
 ↑↓ 이동 │ Enter 상세/실행 │ 1-6 탭전환 │ r 새로고침 │ q 종료
```

### Dashboard Tabs & Keys

| Tab | Enter | c | t | u | e | d | v |
|-----|-------|---|---|---|---|---|---|
| **1:워크플로우** | 노드/엣지 구조 | - | - | - | - | - | - |
| **2:컬렉션** | 문서 목록 | - | - | - | - | - | - |
| **3:노드** | 파라미터/포트 상세 | - | - | - | - | - | - |
| **4:프롬프트** | 내용 보기 | 생성 | - | 스토어 | 수정 | 삭제 | 버전 |
| **5:도구** | API 테스트 | 생성 | 테스트 | 스토어 | - | - | - |
| **6:MCP** | 도구 목록 | 세션생성 | 도구호출 | - | - | 삭제 | - |

### Sandbox Features

- **Tool Creation**: Name → ID → API URL → Save → Test → Upload to Store
- **Prompt Management**: Create, edit, delete, version control, store upload
- **MCP Session**: Spin up Python/Node MCP servers → list tools → test tool calls
- **API Testing**: Direct HTTP call to any tool's endpoint, results in right panel
- **Workflow Inspection**: View node/edge graph structure of any workflow

## AI Agent

```
❯ show workflows          → lists all XGEN workflows
❯ run #6 "hello"          → executes workflow immediately
❯ collections             → shows document collections
❯ list files in ./src     → browses local filesystem
❯ write a fibonacci func  → generates code + saves file
❯ run npm test            → executes shell command
```

No menus, no wizards. Just tell it what you want.

### Providers (9)

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4o, gpt-4.1, gpt-4o-mini, o3-mini |
| Google Gemini | gemini-2.5-pro, gemini-2.0-flash |
| Anthropic | claude-opus-4, claude-sonnet-4 |
| Ollama | llama3.1, codellama, qwen2.5-coder |
| Groq | llama-3.3-70b, mixtral-8x7b |
| Together AI | Meta-Llama-3.1-70B |
| OpenRouter | multi-model proxy |
| DeepSeek | deepseek-chat, deepseek-coder |
| Custom | any OpenAI-compatible endpoint |

### Built-in Tools (7)

`file_read` `file_write` `file_edit` `bash` `grep` `list_files` `sandbox_run`

### XGEN Platform Tools (10)

`xgen_workflow_list` `xgen_workflow_run` `xgen_workflow_info` `xgen_collection_list` `xgen_document_list` `xgen_document_upload` `xgen_graph_rag_query` `xgen_graph_stats` `xgen_execution_history` `xgen_server_status`

### MCP Integration

Reads `.mcp.json` and auto-connects to MCP servers (stdio transport).

## Commands

| Command | Description |
|---------|-------------|
| `xgen` | AI 코딩 에이전트 (기본) |
| `xgen dash` | TUI 대시보드 |
| `xgen chat` | 워크플로우 대화 |
| `xgen wf ls` | 워크플로우 목록 |
| `xgen wf run <id> "질문"` | 워크플로우 실행 |
| `xgen doc ls` | 문서 목록 |
| `xgen ont query "질문"` | 온톨로지 질의 |
| `xgen provider add` | AI 프로바이더 추가 |
| `xgen config set-server <url>` | 서버 연결 |
| `xgen login` | 서버 로그인 |

## Slash Commands

| Command | Description |
|---------|-------------|
| `/connect` | Connect to XGEN server |
| `/env` | Switch environment |
| `/provider` | Change AI provider |
| `/dashboard` | Open TUI dashboard |
| `/tools` | List available tools |
| `/status` | Show connection status |
| `/save [name]` | Save conversation |
| `/load` | Load previous conversation |
| `/usage` | Show token usage |
| `/clear` | Reset conversation |
| `/exit` | Quit |

## Config

```
~/.xgen/
├── config.json          server URL, defaults
├── auth.json            login tokens
├── providers.json       AI providers
├── environments.json    server profiles
└── conversations/       saved chat sessions
```

## Development

```bash
git clone https://github.com/jinsoo96/openxgen.git
cd openxgen
npm install
npm run build
npm link                 # or: alias xgen="node $(pwd)/dist/index.js"
```

## Links

- npm: https://www.npmjs.com/package/openxgen
- GitHub: https://github.com/jinsoo96/openxgen

## License

MIT
