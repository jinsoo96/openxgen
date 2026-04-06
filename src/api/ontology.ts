/**
 * 온톨로지 / GraphRAG API
 */
import { getClient } from "./client.js";

export interface GraphRAGResult {
  answer?: string;
  sources?: string[];
  scs_context?: string;
  triples_used?: string[];
}

export interface GraphStats {
  total_nodes?: number;
  total_edges?: number;
  total_classes?: number;
  total_instances?: number;
}

export async function queryGraphRAG(
  query: string,
  graphId?: string,
  opts?: { scs?: boolean }
): Promise<GraphRAGResult> {
  const client = getClient();
  const res = await client.post("/api/graph-rag", {
    query,
    graph_id: graphId,
    use_scs: opts?.scs ?? true,
  });
  return res.data;
}

export async function queryGraphRAGMultiTurn(
  query: string,
  sessionId: string,
  graphId?: string,
  opts?: { maxTurns?: number }
): Promise<GraphRAGResult & { session_id?: string }> {
  const client = getClient();
  const res = await client.post("/api/graph-rag/multi-turn", {
    query,
    session_id: sessionId,
    graph_id: graphId,
    max_turns: opts?.maxTurns ?? 5,
  });
  return res.data;
}

export async function getGraphStats(graphId: string): Promise<GraphStats> {
  const client = getClient();
  const res = await client.get(`/api/graph/${graphId}/stats`);
  return res.data;
}

export async function listGraphs(): Promise<{ id: string; name?: string }[]> {
  const client = getClient();
  const res = await client.get("/api/graph/list");
  return res.data.graphs ?? res.data ?? [];
}
