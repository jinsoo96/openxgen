/**
 * API 공통 타입 정의
 */

export interface ApiError {
  detail: string;
  status_code?: number;
}

export interface BaseResponse {
  result: string;
  message?: string;
}

export interface SSEEvent {
  type: "token" | "log" | "node_status" | "tool" | "complete" | "error" | "status";
  content?: string;
  data?: unknown;
  node_id?: string;
  node_name?: string;
  status?: string;
  error?: string;
}
