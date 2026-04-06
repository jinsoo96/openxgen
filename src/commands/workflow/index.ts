/**
 * xgen workflow — 워크플로우 커맨드 그룹
 */
import { Command } from "commander";
import { workflowList } from "./list.js";
import { workflowInfo } from "./info.js";
import { workflowRun } from "./run.js";
import { workflowHistory } from "./history.js";

export function registerWorkflowCommand(program: Command): void {
  const wf = program
    .command("workflow")
    .alias("wf")
    .description("워크플로우 관리 및 실행");

  wf.command("list")
    .alias("ls")
    .description("워크플로우 목록 조회")
    .option("-d, --detail", "상세 정보 포함")
    .action((opts) => workflowList(opts));

  wf.command("info <workflow-id>")
    .description("워크플로우 상세 정보")
    .action((id) => workflowInfo(id));

  wf.command("run <workflow-id> [input]")
    .description("워크플로우 실행")
    .option("-i, --interactive", "인터랙티브 모드 (입력 프롬프트)")
    .option("-l, --logs", "디버그 로그 표시")
    .action((id, input, opts) => workflowRun(id, input, opts));

  wf.command("history [workflow-id]")
    .description("실행 이력 조회")
    .option("-n, --limit <number>", "조회 건수", "20")
    .action((id, opts) => workflowHistory(id, { limit: parseInt(opts.limit) }));
}
