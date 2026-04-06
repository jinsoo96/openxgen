/**
 * 출력 포맷팅 유틸리티
 */
import chalk from "chalk";

export function printHeader(text: string): void {
  const line = "─".repeat(Math.max(text.length + 4, 40));
  console.log(chalk.cyan(line));
  console.log(chalk.cyan.bold(`  ${text}`));
  console.log(chalk.cyan(line));
}

export function printSuccess(text: string): void {
  console.log(chalk.green(`✓ ${text}`));
}

export function printError(text: string): void {
  console.error(chalk.red(`✗ ${text}`));
}

export function printWarning(text: string): void {
  console.log(chalk.yellow(`⚠ ${text}`));
}

export function printInfo(text: string): void {
  console.log(chalk.blue(`ℹ ${text}`));
}

export function printKeyValue(key: string, value: string | number | boolean | null | undefined): void {
  console.log(`  ${chalk.gray(key + ":")} ${value ?? chalk.dim("(없음)")}`);
}

export function printTable(headers: string[], rows: string[][]): void {
  // 각 컬럼의 최대 너비 계산
  const widths = headers.map((h, i) => {
    const colMax = rows.reduce((max, row) => Math.max(max, (row[i] ?? "").length), 0);
    return Math.max(h.length, colMax);
  });

  // 헤더 출력
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join("  ");
  console.log(chalk.bold(headerLine));
  console.log(chalk.gray("─".repeat(headerLine.length)));

  // 행 출력
  for (const row of rows) {
    const line = row.map((cell, i) => (cell ?? "").padEnd(widths[i])).join("  ");
    console.log(line);
  }
}

export function truncate(text: string, maxLen = 50): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR") + " " + d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}
