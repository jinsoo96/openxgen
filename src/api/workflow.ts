/**
 * 워크플로우 API
 */
import { getClient } from "./client.js";

export interface Workflow {
  id?: string;
  workflow_id?: string;
  workflow_name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  deploy_status?: string;
  version?: string;
}

export interface WorkflowDetail {
  id: string;
  workflow_name: string;
  description?: string;
  nodes?: unknown[];
  edges?: unknown[];
  parameters?: Record<string, unknown>;
}

export interface WorkflowExecuteRequest {
  workflow_id: string;
  workflow_name: string;
  input_data: string;
  interaction_id: string;
  parameters?: Record<string, unknown>;
}

export interface IOLog {
  interaction_id: string;
  input_data: string;
  output_data: string;
  created_at: string;
  execution_time?: number;
}

export async function listWorkflows(userId?: string): Promise<Workflow[]> {
  const client = getClient();
  const params: Record<string, string> = {};
  if (userId) params.user_id = userId;

  const res = await client.get("/api/workflow/list", { params });
  return res.data.workflows ?? res.data;
}

export async function getWorkflowDetail(workflowId: string): Promise<WorkflowDetail> {
  const client = getClient();
  const res = await client.get(`/api/workflow/load/${workflowId}`);
  return res.data;
}

export async function getWorkflowListDetail(): Promise<Workflow[]> {
  const client = getClient();
  const res = await client.get("/api/workflow/list/detail");
  return res.data.workflows ?? res.data;
}

/**
 * 워크플로우 스트리밍 실행
 * SSE 응답을 반환 — 호출자가 직접 파싱
 */
export async function executeWorkflowStream(
  request: WorkflowExecuteRequest
): Promise<NodeJS.ReadableStream> {
  const client = getClient();
  const res = await client.post("/api/workflow/execute/based_id/stream", request, {
    responseType: "stream",
    headers: {
      Accept: "text/event-stream",
    },
  });

  return res.data;
}

/**
 * 워크플로우 실행 (JSON 응답)
 * deploy/stream 엔드포인트는 배포 여부 무관하게 workflow_id로 실행 가능
 * response_format=json 으로 non-streaming 응답
 */
export async function executeWorkflow(
  request: WorkflowExecuteRequest & { deploy_key?: string; user_id?: number }
): Promise<unknown> {
  const client = getClient();
  const body = {
    ...request,
    user_id: request.user_id ?? 1,
    response_format: "json",
  };
  const res = await client.post("/api/workflow/execute/deploy/stream", body);
  return res.data;
}

/**
 * 워크플로우 SSE 스트리밍 실행
 * deploy/stream 엔드포인트 + response_format=stream
 * 배포 여부 무관하게 모든 워크플로우 실행 가능
 */
export async function executeWorkflowSSE(
  request: WorkflowExecuteRequest & { deploy_key?: string; user_id?: number }
): Promise<NodeJS.ReadableStream> {
  const client = getClient();
  const body = {
    ...request,
    user_id: request.user_id ?? 1,
    response_format: "stream",
  };
  const res = await client.post("/api/workflow/execute/deploy/stream", body, {
    responseType: "stream",
    headers: { Accept: "text/event-stream" },
  });
  return res.data;
}

export async function getExecutionStatus(executionId: string): Promise<unknown> {
  const client = getClient();
  const res = await client.get(`/api/workflow/execute/status/${executionId}`);
  return res.data;
}

export async function getIOLogs(
  workflowId: string,
  workflowName: string,
  limit = 20
): Promise<IOLog[]> {
  const client = getClient();
  const params: Record<string, string | number> = {
    workflow_id: workflowId,
    workflow_name: workflowName,
    limit,
  };

  const res = await client.get("/api/workflow/io_logs", { params });
  return res.data.in_out_logs ?? res.data ?? [];
}
