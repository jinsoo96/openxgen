/**
 * 컨텍스트 관리 — 자동 압축 + System Reminder
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

type Message = ChatCompletionMessageParam;

const COMPACT_THRESHOLD = 30;  // 메시지 수 초과 시 압축
const KEEP_RECENT = 10;        // 최근 N개 유지
const REMINDER_INTERVAL = 10;  // N턴마다 리마인더 주입

/**
 * 메시지 배열 압축 — 오래된 히스토리를 요약으로 대체
 * LLM 호출 없이 규칙 기반 요약 (비용 절감)
 */
export function compactMessages(messages: Message[]): Message[] {
  if (messages.length <= COMPACT_THRESHOLD) return messages;

  const system = messages[0]; // system prompt
  const toCompress = messages.slice(1, -KEEP_RECENT);
  const recent = messages.slice(-KEEP_RECENT);

  // 압축 대상에서 핵심 정보 추출
  const toolCalls: string[] = [];
  const userRequests: string[] = [];

  for (const msg of toCompress) {
    if (msg.role === "user" && typeof msg.content === "string") {
      userRequests.push(msg.content.slice(0, 80));
    }
    if (msg.role === "assistant" && typeof msg.content === "string" && msg.content) {
      // tool_calls가 있는 assistant 메시지에서 도구 이름 추출
      const tc = (msg as any).tool_calls;
      if (tc && Array.isArray(tc)) {
        for (const t of tc) {
          toolCalls.push(t.function?.name ?? "unknown");
        }
      }
    }
  }

  const summary = [
    `[이전 대화 요약 — ${toCompress.length}개 메시지 압축]`,
    userRequests.length > 0 ? `사용자 요청: ${userRequests.join(" → ")}` : "",
    toolCalls.length > 0 ? `실행된 도구: ${[...new Set(toolCalls)].join(", ")}` : "",
  ].filter(Boolean).join("\n");

  return [
    system,
    { role: "system" as const, content: summary },
    ...recent,
  ];
}

/**
 * System Reminder 주입 — 현재 상태를 에이전트에게 알림
 */
export function shouldInjectReminder(turnCount: number): boolean {
  return turnCount > 0 && turnCount % REMINDER_INTERVAL === 0;
}

export function createReminder(serverUrl?: string, loadedTools?: string[]): Message {
  const lines = [
    `[System Reminder — 턴 ${Date.now()}]`,
    serverUrl ? `서버: ${serverUrl} (연결됨)` : "서버: 미연결",
    loadedTools && loadedTools.length > 0
      ? `활성 XGEN 도구: ${loadedTools.join(", ")}`
      : "XGEN 도구: tool_search로 로드 필요",
  ];
  return { role: "system" as const, content: lines.join("\n") };
}
