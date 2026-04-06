# OPEN XGEN CLI

A terminal-based AI coding agent and XGEN platform CLI. Chat-first interface inspired by Claude Code — talk to your AI, manage workflows, query knowledge graphs, and handle documents, all from the terminal.

## Install

```bash
npm install -g openxgen
```

## Quick Start

```bash
xgen
```

That's it. On first run, you'll be guided through provider setup (OpenAI, Gemini, Anthropic, Ollama, etc.).

## What It Does

```
❯ show workflows          → lists all XGEN workflows
❯ run #6 "hello"          → executes workflow immediately
❯ collections             → shows document collections
❯ list files in ./src     → browses local filesystem
❯ read main.py            → displays file contents
❯ write a fibonacci func  → generates code + saves file
❯ run npm test            → executes shell command
```

No menus, no wizards. Just tell it what you want.

## Features

### AI Agent
- **9 providers**: OpenAI, Gemini, Anthropic, Ollama, Groq, Together AI, OpenRouter, DeepSeek, Custom (OpenAI-compatible)
- **50+ models** with auto-detection from environment variables
- **Streaming** responses with multi-step tool calling (up to 20 rounds)
- **Token usage** tracking per response and per session

### Built-in Tools (7)
`file_read` `file_write` `file_edit` `bash` `grep` `list_files` `sandbox_run`

### XGEN Platform Tools (10)
`xgen_workflow_list` `xgen_workflow_run` `xgen_workflow_info` `xgen_collection_list` `xgen_document_list` `xgen_document_upload` `xgen_graph_rag_query` `xgen_graph_stats` `xgen_execution_history` `xgen_server_status`

### MCP Integration
Reads `.mcp.json` and auto-connects to MCP servers (stdio transport).

### Conversation History
Save and restore chat sessions. Auto-stored in `~/.xgen/conversations/`.

### TUI Dashboard
4-panel blessed-based dashboard: workflows | details | collections | AI chat.

## Slash Commands

| Command | Description |
|---------|-------------|
| `/connect` | Connect to XGEN server (HQ / Jeju / Lotte presets) |
| `/env` | Switch environment |
| `/provider` | Change AI provider |
| `/dashboard` | Open TUI dashboard |
| `/tools` | List available tools |
| `/status` | Show connection status |
| `/save [name]` | Save conversation |
| `/load` | Load previous conversation |
| `/conversations` | List saved conversations |
| `/usage` | Show token usage |
| `/clear` | Reset conversation |
| `/exit` | Quit |

## Providers

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
npm run dev     # watch mode
```

## Links

- npm: https://www.npmjs.com/package/openxgen
- GitHub: https://github.com/jinsoo96/openxgen

## License

MIT
