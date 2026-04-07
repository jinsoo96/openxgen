/**
 * Hooks 시스템 — 도구 실행 전후 검증/로깅
 * 에이전트 컨텍스트 윈도우 밖에서 실행 → 컨텍스트 소비 없음
 */
import { getServer, getAuth } from "../config/store.js";

export interface HookResult {
  proceed: boolean;
  message?: string;        // 차단 시 에이전트에게 전달할 메시지
  modifiedArgs?: Record<string, unknown>;  // 인자 변환
  modifiedResult?: string; // 결과 변환
}

// ── PreToolUse ──

const preHooks: Array<{
  match: (name: string) => boolean;
  handler: (name: string, args: Record<string, unknown>) => HookResult;
}> = [
  // XGEN 미연결 시 XGEN 도구 차단
  {
    match: (name) => name.startsWith("xgen_"),
    handler: () => {
      if (!getServer() || !getAuth()) {
        return { proceed: false, message: "XGEN 서버 미연결. /connect로 연결하세요." };
      }
      return { proceed: true };
    },
  },

  // 위험한 bash 명령 경고
  {
    match: (name) => name === "bash",
    handler: (_name, args) => {
      const cmd = String(args.command ?? "");
      if (/rm\s+-rf\s+[\/~]|dd\s+if=|mkfs|>\s*\/dev\/sd/.test(cmd)) {
        return { proceed: false, message: `위험한 명령어 차단: ${cmd.slice(0, 50)}` };
      }
      return { proceed: true };
    },
  },
];

// ── PostToolUse ──

const postHooks: Array<{
  match: (name: string) => boolean;
  handler: (name: string, result: string) => HookResult;
}> = [
  // 결과가 너무 길면 자동 truncate + 안내
  {
    match: () => true,
    handler: (_name, result) => {
      if (result.length > 6000) {
        return {
          proceed: true,
          modifiedResult: result.slice(0, 5000) +
            `\n\n[... ${result.length - 5000}자 생략. 전체 결과가 필요하면 더 구체적인 조건으로 재조회하세요]`,
        };
      }
      return { proceed: true };
    },
  },
];

// ── 실행 ──

export function runPreHooks(name: string, args: Record<string, unknown>): HookResult {
  for (const hook of preHooks) {
    if (hook.match(name)) {
      const result = hook.handler(name, args);
      if (!result.proceed) return result;
      if (result.modifiedArgs) Object.assign(args, result.modifiedArgs);
    }
  }
  return { proceed: true };
}

export function runPostHooks(name: string, result: string): string {
  let current = result;
  for (const hook of postHooks) {
    if (hook.match(name)) {
      const hr = hook.handler(name, current);
      if (hr.modifiedResult) current = hr.modifiedResult;
    }
  }
  return current;
}
