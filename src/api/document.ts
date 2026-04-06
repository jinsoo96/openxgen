/**
 * 문서/컬렉션 API — 실제 작동하는 엔드포인트
 */
import { getClient } from "./client.js";

export interface Collection {
  id: number;
  collection_make_name: string;
  collection_name: string;
  description?: string;
  total_documents: number;
  total_chunks: number;
  is_shared: boolean;
  share_group?: string;
  init_embedding_model?: string;
  created_at?: string;
}

export interface Document {
  id?: string;
  document_id?: string;
  name?: string;
  file_name?: string;
  file_type?: string;
  status?: string;
  created_at?: string;
  file_size?: number;
}

export async function listCollections(): Promise<Collection[]> {
  const client = getClient();
  const res = await client.get("/api/retrieval/collections");
  return Array.isArray(res.data) ? res.data : res.data.collections ?? [];
}

export async function listDocuments(collectionId?: string): Promise<Document[]> {
  const client = getClient();
  try {
    const params: Record<string, string> = {};
    if (collectionId) params.collection_id = collectionId;
    const res = await client.get("/api/retrieval/documents/list", { params });
    return res.data.documents ?? res.data ?? [];
  } catch {
    return [];
  }
}

export async function uploadDocument(
  filePath: string,
  collectionId?: string,
  name?: string
): Promise<unknown> {
  const client = getClient();
  const { createReadStream, statSync } = await import("node:fs");
  const { basename } = await import("node:path");
  const stat = statSync(filePath);
  const fileName = name || basename(filePath);

  const form = new FormData();
  const fileBlob = new Blob([createReadStream(filePath) as unknown as BlobPart]);
  form.append("file", fileBlob, fileName);
  if (collectionId) form.append("collection_id", collectionId);

  const res = await client.post("/api/retrieval/documents/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    maxBodyLength: stat.size + 1024 * 1024,
  });
  return res.data;
}

export async function getDocumentInfo(docId: string): Promise<Document> {
  const client = getClient();
  const res = await client.get(`/api/retrieval/documents/${docId}`);
  return res.data;
}
