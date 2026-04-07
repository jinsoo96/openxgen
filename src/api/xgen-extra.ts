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

export async function createPrompt(data: { name: string; content: string; prompt_type?: string; language?: string }): Promise<unknown> {
  const client = getClient();
  const res = await client.post("/api/prompt/create", data);
  return res.data;
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

// ── MCP ──

export async function listMcpSessions(): Promise<unknown[]> {
  const client = getClient();
  const res = await client.get("/api/mcp/sessions");
  return res.data.sessions ?? res.data ?? [];
}
