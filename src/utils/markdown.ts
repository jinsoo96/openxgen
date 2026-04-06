/**
 * 터미널 마크다운 렌더링 — 가볍게
 * marked-terminal 안 쓰고 직접 처리 (의존성 최소화)
 */
import chalk from "chalk";

/** 코드 블록 감지용 */
const CODE_BLOCK_RE = /```(\w*)\n([\s\S]*?)```/g;
const INLINE_CODE_RE = /`([^`]+)`/g;
const BOLD_RE = /\*\*(.+?)\*\*/g;
const HEADING_RE = /^(#{1,3})\s+(.+)$/gm;
const LIST_RE = /^(\s*)[-*]\s+(.+)$/gm;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

export function renderMarkdown(text: string): string {
  let result = text;

  // 코드 블록: 박스로 표시
  result = result.replace(CODE_BLOCK_RE, (_match, lang, code) => {
    const trimmed = code.trimEnd();
    const header = lang ? chalk.gray(`  ── ${lang} ──`) : chalk.gray("  ── code ──");
    const lines = trimmed.split("\n").map((l: string) => chalk.white(`  ${l}`)).join("\n");
    return `\n${header}\n${lines}\n${chalk.gray("  ──────────")}\n`;
  });

  // 인라인 코드
  result = result.replace(INLINE_CODE_RE, (_m, code) => chalk.cyan(`\`${code}\``));

  // 볼드
  result = result.replace(BOLD_RE, (_m, text) => chalk.bold(text));

  // 헤딩
  result = result.replace(HEADING_RE, (_m, hashes, text) => {
    if (hashes.length === 1) return chalk.bold.underline(text);
    if (hashes.length === 2) return chalk.bold(text);
    return chalk.bold.dim(text);
  });

  // 리스트
  result = result.replace(LIST_RE, (_m, indent, text) => `${indent}${chalk.cyan("•")} ${text}`);

  // 링크
  result = result.replace(LINK_RE, (_m, label, url) => `${chalk.blue.underline(label)} ${chalk.gray(`(${url})`)}`);

  return result;
}
