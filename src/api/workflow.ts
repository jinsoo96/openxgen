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
 * 워크플로우 실행 (non-stream, deploy 엔드포인트)
 * K3s Istio 환경에서 based_id/stream은 Next.js로 라우팅되어 CLI 접근 불가
 * deploy/result 엔드포인트 사용
 */
export async function executeWorkflow(
  request: WorkflowExecuteRequest & { deploy_key?: string }
): Promise<unknown> {
  const client = getClient();
  // deploy_key가 있으면 deploy 엔드포인트, 없으면 based_id
  if (request.deploy_key) {
    const res = await client.post("/api/workflow/execute/deploy/result", request);
    return res.data;
  }
  const res = await client.post("/api/workflow/execute/based_id", request);
  return res.data;
}

export async function getExecutionStatus(executionId: string): Promise<unknown> {
  const client = getClient();
  const res = await client.get(`/api/workflow/execute/status/${executionId}`);
  return res.data;
}

export async function getIOLogs(
  workflowId?: string,
  limit = 20
): Promise<IOLog[]> {
  const client = getClient();
  const params: Record<string, string | number> = { limit };
  if (workflowId) params.workflow_id = workflowId;

  const res = await client.get("/api/workflow/io_logs", { params });
  return res.data;
}
