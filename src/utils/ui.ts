/**
 * OPEN XGEN UI 유틸리티 — 터미널 UI 컴포넌트
 */
import chalk from "chalk";
import { createInterface } from "node:readline";

const W = Math.min(process.stdout.columns || 60, 70);

// ── 박스 ──

export function box(lines: string[], color: "cyan" | "green" | "yellow" | "gray" = "cyan"): string {
  const c = chalk[color];
  const inner = W - 4;
  const top = c("  ╭" + "─".repeat(inner) + "╮");
  const bot = c("  ╰" + "─".repeat(inner) + "╯");
  const body = lines.map((line) => {
    const clean = line.replace(/\x1b\[[0-9;]*m/g, "");
    const pad = Math.max(0, inner - clean.length);
    return c("  │ ") + line + " ".repeat(pad) + c(" │");
  });
  return [top, ...body, bot].join("\n");
}

// ── 구분선 ──

export function divider(label?: string): string {
  if (label) {
    const rest = W - label.length - 6;
    return chalk.gray(`  ── ${label} ${"─".repeat(Math.max(0, rest))}`);
  }
  return chalk.gray("  " + "─".repeat(W - 2));
}

// ── 상태 표시 ──

export function statusDot(active: boolean, label: string, detail?: string): string {
  const dot = active ? chalk.green("●") : chalk.gray("○");
  const d = detail ? chalk.gray(` ${detail}`) : "";
  return `  ${dot} ${label}${d}`;
}

// ── 번호 메뉴 ──

export interface MenuItem {
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function menu(items: MenuItem[], opts?: { title?: string }): string {
  const lines: string[] = [];
  if (opts?.title) {
    lines.push("");
    lines.push(chalk.bold(`  ${opts.title}`));
    lines.push("");
  }
  items.forEach((item, i) => {
    const num = chalk.cyan.bold(` ${String(i + 1).padStart(2)}.`);
    const hint = item.hint ? chalk.gray(` — ${item.hint}`) : "";
    const label = item.disabled ? chalk.gray(item.label) : item.label;
    lines.push(`  ${num} ${label}${hint}`);
  });
  lines.push("");
  return lines.join("\n");
}

// ── 프롬프트 ──

export function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── 채팅 메시지 ──

export function userMsg(text: string): string {
  return `\n  ${chalk.blue.bold("You")} ${chalk.gray("›")} ${text}`;
}

export function aiMsg(name: string): string {
  return `\n  ${chalk.green.bold(name)} ${chalk.gray("›")} `;
}

export function toolCall(name: string, summary: string): string {
  return chalk.gray(`  ⚙ ${chalk.white(name)} ${summary}`);
}

export function toolResult(text: string): string {
  const lines = text.split("\n").slice(0, 5);
  return lines.map((l) => chalk.gray(`    │ ${l}`)).join("\n");
}

// ── 환영 메시지 ──

export function welcome(): string {
  const logo = chalk.cyan(`
   ██████  ██████  ███████ ███    ██
  ██    ██ ██   ██ ██      ████   ██
  ██    ██ ██████  █████   ██ ██  ██
  ██    ██ ██      ██      ██  ██ ██
   ██████  ██      ███████ ██   ████`) +
    chalk.white.bold(`
  ██   ██  ██████  ███████ ███    ██
   ██ ██  ██       ██      ████   ██
    ███   ██   ███ █████   ██ ██  ██
   ██ ██  ██    ██ ██      ██  ██ ██
  ██   ██  ██████  ███████ ██   ████`);

  return logo;
}

// ── 진행 표시 ──

export function spinner(): { update: (text: string) => void; stop: () => void } {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let text = "";
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${chalk.cyan(frames[i++ % frames.length])} ${chalk.gray(text)}`);
  }, 80);

  return {
    update(t: string) { text = t; },
    stop() {
      clearInterval(interval);
      process.stdout.write("\r" + " ".repeat(W) + "\r");
    },
  };
}
