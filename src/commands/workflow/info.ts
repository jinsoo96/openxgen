/**
 * xgen workflow info <id> — 워크플로우 상세 정보
 */
import chalk from "chalk";
import { requireAuth } from "../../config/store.js";
import { getWorkflowDetail } from "../../api/workflow.js";
import { printError, printHeader, printKeyValue } from "../../utils/format.js";

export async function workflowInfo(workflowId: string): Promise<void> {
  requireAuth();

  try {
    const detail = await getWorkflowDetail(workflowId);

    printHeader(`워크플로우: ${detail.workflow_name ?? workflowId}`);
    console.log();

    printKeyValue("ID", detail.id);
    printKeyValue("이름", detail.workflow_name);
    printKeyValue("설명", detail.description ?? "(없음)");

    if (detail.nodes && Array.isArray(detail.nodes)) {
      console.log();
      console.log(chalk.bold("  노드 구성:"));
      for (const node of detail.nodes as Array<{ id: string; data?: { label?: string; type?: string } }>) {
        const label = node.data?.label ?? node.id;
        const type = node.data?.type ?? "unknown";
        console.log(`    ${chalk.cyan("•")} ${label} ${chalk.gray(`(${type})`)}`);
      }
    }

    if (detail.parameters && Object.keys(detail.parameters).length > 0) {
      console.log();
      console.log(chalk.bold("  파라미터:"));
      for (const [key, val] of Object.entries(detail.parameters)) {
        console.log(`    ${chalk.gray(key)}: ${JSON.stringify(val)}`);
      }
    }

    console.log();
  } catch (err: unknown) {
    const msg = (err as Error).message;
    printError(`워크플로우 조회 실패: ${msg}`);
    process.exit(1);
  }
}
