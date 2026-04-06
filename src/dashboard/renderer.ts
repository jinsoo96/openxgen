/**
 * OPEN XGEN 대시보드 렌더러 — 탭 기반 TUI
 */
import chalk from "chalk";

const W = () => Math.min(process.stdout.columns || 80, 100);
const H = () => Math.min(process.stdout.rows || 30, 40);

export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

export function moveTo(row: number, col: number): void {
  process.stdout.write(`\x1b[${row};${col}H`);
}

export function hideCursor(): void {
  process.stdout.write("\x1b[?25l");
}

export function showCursor(): void {
  process.stdout.write("\x1b[?25h");
}

// ── 헤더 바 ──

export function renderHeader(activeTab: string, tabs: string[], env?: string): void {
  const w = W();
  const title = chalk.cyan.bold(" OPEN XGEN ");
  const envTag = env ? chalk.gray(` · ${env}`) : "";

  // 탭 바
  const tabBar = tabs.map((t) => {
    if (t === activeTab) return chalk.bgCyan.black(` ${t} `);
    return chalk.gray(` ${t} `);
  }).join(chalk.gray("│"));

  console.log(chalk.bgGray.black(" ".repeat(w)));
  console.log(chalk.bgGray.black(`${title}${envTag}${" ".repeat(Math.max(0, w - stripAnsi(title + envTag).length))}`));
  console.log(chalk.gray("─".repeat(w)));
  console.log(tabBar);
  console.log(chalk.gray("─".repeat(w)));
}

// ── 상태 바 (하단) ──

export function renderStatusBar(text: string): void {
  const w = W();
  const padded = ` ${text}${" ".repeat(Math.max(0, w - text.length - 1))}`;
  console.log(chalk.gray("─".repeat(w)));
  console.log(chalk.bgGray.black(padded));
}

// ── 리스트 ──

export interface ListItem {
  label: string;
  detail?: string;
  tag?: string;
}

export function renderList(items: ListItem[], selected: number, title?: string, startRow?: number): void {
  if (title) console.log(chalk.bold(`  ${title}`));
  console.log();

  const pageSize = H() - 12;
  const start = Math.max(0, selected - pageSize + 3);
  const visible = items.slice(start, start + pageSize);

  visible.forEach((item, i) => {
    const idx = start + i;
    const cursor = idx === selected ? chalk.cyan("▸ ") : "  ";
    const num = chalk.gray(`${String(idx + 1).padStart(3)}.`);
    const tag = item.tag ? ` ${item.tag}` : "";
    const line = `${cursor}${num} ${item.label}${tag}`;

    if (idx === selected) {
      console.log(chalk.white.bold(line));
      if (item.detail) console.log(chalk.gray(`       ${item.detail}`));
    } else {
      console.log(line);
    }
  });

  if (items.length > pageSize) {
    console.log(chalk.gray(`\n  ${start + 1}-${Math.min(start + pageSize, items.length)} / ${items.length}`));
  }
}

// ── 패널 ──

export function renderPanel(title: string, lines: string[]): void {
  const w = W() - 4;
  console.log(chalk.cyan(`  ┌${"─".repeat(w)}┐`));
  console.log(chalk.cyan(`  │ ${chalk.bold(title)}${" ".repeat(Math.max(0, w - stripAnsi(title).length - 1))}│`));
  console.log(chalk.cyan(`  ├${"─".repeat(w)}┤`));
  for (const line of lines) {
    const clean = stripAnsi(line);
    const pad = Math.max(0, w - clean.length - 1);
    console.log(chalk.cyan(`  │ `) + line + " ".repeat(pad) + chalk.cyan("│"));
  }
  console.log(chalk.cyan(`  └${"─".repeat(w)}┘`));
}

// ── 채팅 메시지 ──

export function renderChat(messages: { role: string; text: string }[]): void {
  const recent = messages.slice(-10);
  for (const msg of recent) {
    if (msg.role === "user") {
      console.log(`  ${chalk.blue.bold("You")} ${chalk.gray("›")} ${msg.text}`);
    } else {
      console.log(`  ${chalk.green.bold("AI")}  ${chalk.gray("›")} ${msg.text}`);
    }
  }
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}
