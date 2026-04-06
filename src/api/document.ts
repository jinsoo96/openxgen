/**
 * 문서 API
 */
import { getClient } from "./client.js";
import { createReadStream, statSync } from "node:fs";
import { basename } from "node:path";

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

export async function listDocuments(collectionId?: string): Promise<Document[]> {
  const client = getClient();
  const params: Record<string, string> = {};
  if (collectionId) params.collection_id = collectionId;

  const res = await client.get("/api/documents/list", { params });
  return res.data.documents ?? res.data ?? [];
}

export async function uploadDocument(
  filePath: string,
  collectionId?: string,
  name?: string
): Promise<unknown> {
  const client = getClient();
  const stat = statSync(filePath);
  const fileName = name || basename(filePath);

  const FormData = (await import("node:buffer")).Blob ? globalThis.FormData : null;
  if (!FormData) throw new Error("FormData not available");

  const form = new FormData();
  const fileBlob = new Blob([createReadStream(filePath) as unknown as BlobPart]);
  form.append("file", fileBlob, fileName);
  if (collectionId) form.append("collection_id", collectionId);

  const res = await client.post("/api/documents/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    maxBodyLength: stat.size + 1024 * 1024,
  });

  return res.data;
}

export async function getDocumentInfo(docId: string): Promise<Document> {
  const client = getClient();
  const res = await client.get(`/api/documents/${docId}`);
  return res.data;
}
