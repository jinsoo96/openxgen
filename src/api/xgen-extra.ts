/**
 * XGEN 확장 API — 노드, 프롬프트, 도구, 스케줄, 인터랙션, 트레이스, MCP
 */
import { getClient } from "./client.js";

// ── Node ──

export async function listNodes(): Promise<unknown[]> {
  const client = getClient();
  const res = await client.get("/api/node/get");
  return res.data.nodes ?? res.data ?? [];
}

export async function searchNodes(query: string): Promise<unknown[]> {
  const client = getClient();
  const res = await client.get("/api/node/search", { params: { query } });
  return res.data.nodes ?? res.data ?? [];
}

export async function getNodeDetail(nodeId: string): Promise<unknown> {
  const client = getClient();
  const res = await client.get("/api/node/detail", { params: { node_id: nodeId } });
  return res.data;
}

export async function getNodeCategories(): Promise<unknown[]> {
  const client = getClient();
  const res = await client.get("/api/node/categories");
  return res.data.categories ?? res.data ?? [];
}

// ── Prompt ──

export async function listPrompts(opts?: { limit?: number; language?: string }): Promise<unknown[]> {
  const client = getClient();
  const params: Record<string, unknown> = { limit: opts?.limit ?? 100 };
  if (opts?.language) params.language = opts.language;
  const res = await client.get("/api/prompt/list", { params });
  return res.data.prompts ?? res.data ?? [];
}

// ── Tools ──

export async function listToolStore(): Promise<unknown[]> {
  const client = getClient();
  const res = await client.get("/api/tools/store/list");
  return res.data.tools ?? res.data ?? [];
}

export async function listUserTools(): Promise<unknown[]> {
  const client = getClient();
  const res = await client.get("/api/tools/storage/list");
  return res.data.tools ?? res.data ?? [];
}

// ── Schedule ──

export async function listSchedules(): Promise<unknown[]> {
  const client = getClient();
  const res = await client.get("/api/workflow/schedule/sessions");
  return res.data.sessions ?? res.data ?? [];
}

export async function getSchedulerStatus(): Promise<unknown> {
  const client = getClient();
  const res = await client.get("/api/workflow/schedule/status");
  return res.data;
}

// ── Interaction / Trace ──

export async function listInteractions(workflowId?: string, limit = 20): Promise<unknown[]> {
  const client = getClient();
  const params: Record<string, unknown> = { limit };
  if (workflowId) params.workflow_id = workflowId;
  const res = await client.get("/api/interaction/list", { params });
  return res.data.interactions ?? res.data ?? [];
}

export async function listTraces(workflowId?: string, page = 1): Promise<unknown> {
  const client = getClient();
  const params: Record<string, unknown> = { page, page_size: 20 };
  if (workflowId) params.workflow_id = workflowId;
  const res = await client.get("/api/workflow/trace/list", { params });
  return res.data;
}

export async function getTraceDetail(traceId: string): Promise<unknown> {
  const client = getClient();
  const res = await client.get(`/api/workflow/trace/detail/${traceId}`);
  return res.data;
}

// ── Workflow Store ──

export async function listWorkflowStore(): Promise<unknown[]> {
  const client = getClient();
  const res = await client.get("/api/workflow/store/list");
  return res.data.workflows ?? res.data ?? [];
}

// ── Workflow Auto-generation ──

export async function generateWorkflow(requirements: string): Promise<unknown> {
  const client = getClient();
  const res = await client.post("/api/workflow/auto-generation/generate", { requirements });
  return res.data;
}

// ── Performance ──

export async function getWorkflowPerformance(workflowId: string, workflowName: string): Promise<unknown> {
  const client = getClient();
  const res = await client.get("/api/workflow/performance", {
    params: { workflow_id: workflowId, workflow_name: workflowName },
  });
  return res.data;
}

// ── Tool Storage (사용자 도구 CRUD) ──

export interface SaveToolData {
  function_name: string;
  function_id: string;
  description?: string;
  api_url: string;
  api_method?: string;
  api_header?: Record<string, unknown>;
  api_body?: Record<string, unknown>;
  static_body?: Record<string, unknown>;
  body_type?: string;
  api_timeout?: number;
  response_filter?: boolean;
  response_filter_path?: string;
  response_filter_field?: string;
  metadata?: Record<string, unknown>;
}

export async function saveTool(functionName: string, content: SaveToolData): Promise<unknown> {
  const client = getClient();
  const res = await client.post("/api/tools/storage/save", { function_name: functionName, content });
  return res.data;
}

export async function apiTest(params: {
  api_url: string;
  api_method?: string;
  api_headers?: Record<string, unknown>;
  static_body?: Record<string, unknown>;
  body_type?: string;
  api_timeout?: number;
}): Promise<unknown> {
  const client = getClient();
  const res = await client.post("/api/tools/storage/api-test", params);
  return res.data;
}

export async function toolTest(toolId: number, functionId: string): Promise<unknown> {
  const client = getClient();
  const res = await client.post(`/api/tools/storage/tool-test?tool_id=${toolId}&function_id=${functionId}`);
  return res.data;
}

export async function uploadToolToStore(functionUploadId: string, description?: string, tags?: string[]): Promise<unknown> {
  const client = getClient();
  const res = await client.post("/api/tools/store/upload", {
    function_upload_id: functionUploadId,
    description: description ?? "",
    tags: tags ?? [],
  });
  return res.data;
}

// ── Prompt CRUD ──

export async function createPrompt(data: {
  prompt_title: string;
  prompt_content: string;
  public_available?: boolean;
  language?: string;
  prompt_type?: string;
}): Promise<unknown> {
  const client = getClient();
  const res = await client.post("/api/prompt/create", data);
  return res.data;
}

export async function updatePrompt(data: {
  prompt_uid: string;
  prompt_title?: string;
  prompt_content?: string;
  public_available?: boolean;
  prompt_type?: string;
}): Promise<unknown> {
  const client = getClient();
  const res = await client.post("/api/prompt/update", data);
  return res.data;
}

export async function deletePrompt(promptUid: string): Promise<unknown> {
  const client = getClient();
  const res = await client.post("/api/prompt/delete", { prompt_uid: promptUid });
  return res.data;
}

// ── Node 추가 ──

export async function getNodeTags(): Promise<string[]> {
  const client = getClient();
  const res = await client.get("/api/node/tags");
  return res.data ?? [];
}

export async function getNodeParameters(nodeId: string): Promise<unknown> {
  const client = getClient();
  const res = await client.get(`/api/node/parameters/categorized/${nodeId}`);
  return res.data;
}

// ── Prompt Store ──

export async function listPromptStore(): Promise<unknown[]> {
  const client = getClient();
  const res = await client.post("/api/prompt/store/list");
  return res.data.prompts ?? res.data ?? [];
}

export async function uploadPromptToStore(promptId: number): Promise<unknown> {
  const client = getClient();
  const res = await client.post(`/api/prompt/store/upload`, null, { params: { prompt_id: promptId } });
  return res.data;
}

export async function listPromptVersions(promptUid: string): Promise<unknown[]> {
  const client = getClient();
  const res = await client.get("/api/prompt/version/list", { params: { prompt_uid: promptUid } });
  return res.data.versions ?? res.data ?? [];
}

export async function changePromptVersion(promptUid: string, version: number): Promise<unknown> {
  const client = getClient();
  const res = await client.post("/api/prompt/version/change", { prompt_uid: promptUid, version });
  return res.data;
}

// ── MCP Station ──

export async function listMcpSessions(): Promise<unknown[]> {
  const client = getClient();
  const res = await client.get("/api/mcp/sessions");
  return res.data.sessions ?? res.data ?? [];
}

export async function createMcpSession(data: {
  server_type: "python" | "node";
  server_command: string;
  server_args?: string[];
  env_vars?: Record<string, string>;
  working_dir?: string;
  session_name?: string;
}): Promise<unknown> {
  const client = getClient();
  const res = await client.post("/api/mcp/sessions", data);
  return res.data;
}

export async function getMcpSession(sessionId: string): Promise<unknown> {
  const client = getClient();
  const res = await client.get(`/api/mcp/sessions/${sessionId}`);
  return res.data;
}

export async function deleteMcpSession(sessionId: string): Promise<void> {
  const client = getClient();
  await client.delete(`/api/mcp/sessions/${sessionId}`);
}

export async function getMcpSessionTools(sessionId: string): Promise<unknown[]> {
  const client = getClient();
  const res = await client.get(`/api/mcp/sessions/${sessionId}/tools`);
  return res.data.tools ?? res.data ?? [];
}

export async function sendMcpRequest(sessionId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
  const client = getClient();
  const res = await client.post("/api/mcp/mcp-request", {
    session_id: sessionId,
    method,
    params,
  });
  return res.data;
}
