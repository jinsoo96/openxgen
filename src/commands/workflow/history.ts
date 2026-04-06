/**
 * xgen workflow history — 실행 이력 조회
 */
import chalk from "chalk";
import { requireAuth } from "../../config/store.js";
import { getIOLogs } from "../../api/workflow.js";
import { printError, printHeader, truncate, formatDate } from "../../utils/format.js";

export async function workflowHistory(
  workflowId?: string,
  opts: { limit?: number } = {}
): Promise<void> {
  requireAuth();

  const limit = opts.limit ?? 20;

  try {
    const logs = await getIOLogs(workflowId, limit);

    if (!logs || logs.length === 0) {
      console.log(chalk.yellow("\n실행 이력이 없습니다.\n"));
      return;
    }

    printHeader(`실행 이력 (최근 ${logs.length}건)`);
    console.log();

    for (const log of logs) {
      console.log(
        `  ${chalk.gray(formatDate(log.created_at))} ${chalk.cyan(log.interaction_id)}`
      );
      console.log(`    ${chalk.white("입력:")} ${truncate(log.input_data, 60)}`);
      console.log(
        `    ${chalk.green("출력:")} ${truncate(log.output_data, 60)}`
      );
      if (log.execution_time) {
        console.log(
          `    ${chalk.gray("시간:")} ${(log.execution_time / 1000).toFixed(1)}s`
        );
      }
      console.log();
    }
  } catch (err: unknown) {
    const msg = (err as Error).message;
    printError(`이력 조회 실패: ${msg}`);
    process.exit(1);
  }
}
