/**
 * xgen workflow list — 워크플로우 목록 조회
 */
import chalk from "chalk";
import { requireAuth } from "../../config/store.js";
import { listWorkflows, getWorkflowListDetail } from "../../api/workflow.js";
import { printTable, printError, printHeader, truncate, formatDate } from "../../utils/format.js";

export async function workflowList(opts: { detail?: boolean }): Promise<void> {
  requireAuth();

  try {
    if (opts.detail) {
      const workflows = await getWorkflowListDetail();

      if (!workflows || workflows.length === 0) {
        console.log(chalk.yellow("\n워크플로우가 없습니다.\n"));
        return;
      }

      printHeader(`워크플로우 목록 (${workflows.length}개)`);
      console.log();

      printTable(
        ["#", "ID", "이름", "배포", "업데이트"],
        workflows.map((w, i) => [
          String(i + 1),
          (w.workflow_id ?? w.id ?? "-").slice(0, 12),
          truncate(w.workflow_name ?? "-", 30),
          (w as Record<string, unknown>).is_deployed
            ? chalk.green("배포됨")
            : chalk.gray("미배포"),
          formatDate(w.updated_at),
        ])
      );
    } else {
      const workflows = await listWorkflows();

      if (!workflows || workflows.length === 0) {
        console.log(chalk.yellow("\n워크플로우가 없습니다.\n"));
        return;
      }

      printHeader(`워크플로우 목록 (${workflows.length}개)`);
      console.log();

      printTable(
        ["#", "ID", "이름"],
        workflows.map((w, i) => [
          String(i + 1),
          (w.workflow_id ?? w.id ?? "-").slice(0, 12),
          w.workflow_name ?? "-",
        ])
      );
    }
    console.log();
  } catch (err: unknown) {
    const msg = (err as Error).message;
    printError(`워크플로우 목록 조회 실패: ${msg}`);
    process.exit(1);
  }
}
