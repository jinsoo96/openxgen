/**
 * LLM 클라이언트 — OpenAI SDK 기반 멀티 프로바이더
 */
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { ProviderConfig } from "../config/store.js";

export type { ChatCompletionMessageParam as Message, ChatCompletionTool as ToolDef };

export function createLLMClient(provider: ProviderConfig): OpenAI {
  const opts: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey: provider.apiKey || "ollama",
  };

  if (provider.baseUrl) {
    opts.baseURL = provider.baseUrl;
  }

  return new OpenAI(opts);
}

export interface StreamResult {
  content: string;
  toolCalls: {
    id: string;
    name: string;
    arguments: string;
  }[];
}

/**
 * 스트리밍 채팅 — content를 실시간 출력하고 tool_calls를 수집
 */
export async function streamChat(
  client: OpenAI,
  model: string,
  messages: ChatCompletionMessageParam[],
  tools?: ChatCompletionTool[],
  onDelta?: (text: string) => void
): Promise<StreamResult> {
  const params: OpenAI.ChatCompletionCreateParamsStreaming = {
    model,
    messages,
    stream: true,
  };

  if (tools && tools.length > 0) {
    params.tools = tools;
  }

  const stream = await client.chat.completions.create(params);

  let content = "";
  const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      content += delta.content;
      onDelta?.(delta.content);
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index;
        if (!toolCallMap.has(idx)) {
          toolCallMap.set(idx, { id: tc.id ?? "", name: tc.function?.name ?? "", arguments: "" });
        }
        const entry = toolCallMap.get(idx)!;
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name = tc.function.name;
        if (tc.function?.arguments) entry.arguments += tc.function.arguments;
      }
    }
  }

  return {
    content,
    toolCalls: [...toolCallMap.values()],
  };
}
