/**
 * SSE (Server-Sent Events) 파서
 * 워크플로우 스트리밍 응답 처리
 */
import type { SSEEvent } from "../api/types.js";

/**
 * ReadableStream에서 SSE 이벤트를 파싱하여 콜백으로 전달
 */
export async function parseSSEStream(
  stream: NodeJS.ReadableStream,
  onEvent: (event: SSEEvent) => void,
  onDone?: () => void,
  onError?: (error: Error) => void
): Promise<void> {
  let buffer = "";

  return new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();

      // SSE 이벤트 파싱: 빈 줄로 구분
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split("\n");
        let data = "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            data += line.slice(6);
          } else if (line.startsWith("data:")) {
            data += line.slice(5);
          }
        }

        if (!data) continue;

        try {
          const event = JSON.parse(data) as SSEEvent;
          onEvent(event);
        } catch {
          // JSON 파싱 실패 시 텍스트로 처리
          onEvent({ type: "token", content: data });
        }
      }
    });

    stream.on("end", () => {
      // 남은 버퍼 처리
      if (buffer.trim()) {
        const lines = buffer.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6)) as SSEEvent;
              onEvent(event);
            } catch {
              onEvent({ type: "token", content: line.slice(6) });
            }
          }
        }
      }
      onDone?.();
      resolve();
    });

    stream.on("error", (err: Error) => {
      onError?.(err);
      reject(err);
    });
  });
}
