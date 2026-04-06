/**
 * MCP (Model Context Protocol) 클라이언트
 * .mcp.json 설정을 읽어서 stdio MCP 서버와 통신
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

interface McpServerConfig {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export class McpClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private serverName: string;
  private config: McpServerConfig;
  private tools: McpTool[] = [];

  constructor(serverName: string, config: McpServerConfig) {
    this.serverName = serverName;
    this.config = config;
  }

  async start(): Promise<void> {
    this.process = spawn(this.config.command, this.config.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.config.env },
    });

    const rl = createInterface({ input: this.process.stdout! });
    rl.on("line", (line) => {
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) {
            p.reject(new Error(msg.error.message));
          } else {
            p.resolve(msg.result);
          }
        }
      } catch {
        // ignore non-JSON lines
      }
    });

    this.process.on("error", (err) => {
      console.error(`MCP [${this.serverName}] 프로세스 오류:`, err.message);
    });

    // Initialize
    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "open-xgen", version: "0.3.0" },
    });

    await this.send("notifications/initialized", {});
  }

  private send(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };

      this.pending.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP 요청 타임아웃: ${method}`));
      }, 15_000);

      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      this.process?.stdin?.write(JSON.stringify(request) + "\n");
    });
  }

  async listTools(): Promise<McpTool[]> {
    const result = (await this.send("tools/list", {})) as { tools: McpTool[] };
    this.tools = result.tools ?? [];
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = (await this.send("tools/call", { name, arguments: args })) as {
      content?: { type: string; text?: string }[];
    };
    return result.content?.map((c) => c.text ?? "").join("\n") ?? "";
  }

  getOpenAITools(): ChatCompletionTool[] {
    return this.tools.map((t) => ({
      type: "function" as const,
      function: {
        name: `mcp_${this.serverName}_${t.name}`,
        description: `[MCP:${this.serverName}] ${t.description ?? t.name}`,
        parameters: (t.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
      },
    }));
  }

  stop(): void {
    this.process?.kill();
    this.process = null;
  }
}

/**
 * .mcp.json에서 MCP 서버 설정 로드
 */
export function loadMcpConfig(dir?: string): McpConfig | null {
  const searchPaths = [
    dir ? join(dir, ".mcp.json") : null,
    join(process.cwd(), ".mcp.json"),
    join(process.env.HOME ?? "", ".mcp.json"),
  ].filter(Boolean) as string[];

  for (const p of searchPaths) {
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, "utf-8")) as McpConfig;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * 모든 MCP 서버 시작 + 도구 수집
 */
export class McpManager {
  private clients = new Map<string, McpClient>();

  async startAll(config: McpConfig): Promise<void> {
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      if (serverConfig.type !== "stdio") continue;
      try {
        const client = new McpClient(name, serverConfig);
        await client.start();
        await client.listTools();
        this.clients.set(name, client);
      } catch (err) {
        console.error(`MCP [${name}] 시작 실패:`, (err as Error).message);
      }
    }
  }

  getAllTools(): ChatCompletionTool[] {
    const tools: ChatCompletionTool[] = [];
    for (const client of this.clients.values()) {
      tools.push(...client.getOpenAITools());
    }
    return tools;
  }

  async callTool(fullName: string, args: Record<string, unknown>): Promise<string> {
    // fullName format: mcp_{serverName}_{toolName}
    const parts = fullName.split("_");
    if (parts.length < 3 || parts[0] !== "mcp") return `Unknown MCP tool: ${fullName}`;

    const serverName = parts[1];
    const toolName = parts.slice(2).join("_");
    const client = this.clients.get(serverName);
    if (!client) return `MCP 서버를 찾을 수 없습니다: ${serverName}`;

    return client.callTool(toolName, args);
  }

  isMcpTool(name: string): boolean {
    return name.startsWith("mcp_");
  }

  stopAll(): void {
    for (const client of this.clients.values()) {
      client.stop();
    }
    this.clients.clear();
  }

  get serverCount(): number {
    return this.clients.size;
  }

  getServerNames(): string[] {
    return [...this.clients.keys()];
  }
}
