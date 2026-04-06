/**
 * xgen workflow run <id> — 워크플로우 실행
 */
import chalk from "chalk";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../../config/store.js";
import { executeWorkflowStream, getWorkflowDetail } from "../../api/workflow.js";
import { parseSSEStream } from "../../utils/sse.js";
import { printError, printHeader, printInfo } from "../../utils/format.js";
import { renderMarkdown } from "../../utils/markdown.js";
import type { SSEEvent } from "../../api/types.js";

export async function workflowRun(
  workflowId: string,
  input: string | undefined,
  opts: { interactive?: boolean; logs?: boolean }
): Promise<void> {
  const auth = requireAuth();

  // 워크플로우 정보 가져오기
  let workflowName = workflowId;
  try {
    const detail = await getWorkflowDetail(workflowId);
    workflowName = detail.workflow_name ?? workflowId;
  } catch {
    // 이름 조회 실패해도 실행은 계속
  }

  // 인터랙티브 모드: 입력이 없으면 프롬���트
  if (!input) {
    if (opts.interactive || !process.stdin.isTTY) {
      const { createInterface } = await import("node:readline");
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      input = await new Promise<string>((resolve) => {
        rl.question(chalk.cyan("입력> "), (answer) => {
          rl.close();
          resolve(answer.trim());
        });
      });
    } else {
      printError("입력값이 필요합니다. 사용법:");
      console.log('  xgen workflow run <id> "입력 텍스���"');
      console.log("  xgen workflow run -i <id>");
      process.exit(1);
    }
  }

  if (!input) {
    printError("입력값이 비어있습니다");
    process.exit(1);
  }

  const interactionId = `cli_${randomUUID().slice(0, 8)}`;

  printHeader(`실행: ${workflowName}`);
  printInfo(`입력: ${input}`);
  console.log();

  try {
    const stream = await executeWorkflowStream({
      workflow_id: workflowId,
      workflow_name: workflowName,
      input_data: input,
      interaction_id: interactionId,
    });

    let hasOutput = false;
    let fullResponse = "";

    await parseSSEStream(
      stream,
      (event: SSEEvent) => {
        switch (event.type) {
          case "token":
            if (event.content) {
              if (!hasOutput) {
                hasOutput = true;
                console.log();
              }
              process.stdout.write(event.content);
              fullResponse += event.content;
            }
            break;

          case "log":
            if (opts.logs && event.content) {
              process.stderr.write(chalk.gray(`[LOG] ${event.content}\n`));
            }
            break;

          case "node_status":
            if (opts.logs) {
              const nodeName = event.node_name ?? event.node_id ?? "?";
              const status = event.status ?? "?";
              process.stderr.write(
                chalk.gray(`[노드] ${nodeName}: ${status}\n`)
              );
            }
            break;

          case "tool":
            if (opts.logs) {
              process.stderr.write(chalk.gray(`[도구] ${JSON.stringify(event.data)}\n`));
            }
            break;

          case "complete":
            break;

          case "error":
            console.log();
            printError(event.error ?? event.content ?? "알 수 없는 오류");
            break;

          default:
            // 알 수 없는 이벤트는 content가 있으면 출력
            if (event.content) {
              if (!hasOutput) {
                process.stdout.write(chalk.green("응답: "));
                hasOutput = true;
              }
              process.stdout.write(event.content);
            }
        }
      },
      () => {
        if (hasOutput) {
          // 스트리밍 끝 — 마크다운이 있으면 렌더링된 버전도 표시
          console.log();
          if (fullResponse.includes("```") || fullResponse.includes("**")) {
            console.log(chalk.gray("─".repeat(40)));
            console.log(renderMarkdown(fullResponse));
          }
        }
        console.log();
        console.log(chalk.gray(`세션: ${interactionId}`));
      },
      (err) => {
        console.log();
        printError(`스트리밍 오류: ${err.message}`);
      }
    );
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail ?? (err as Error).message;
    printError(`실행 실패: ${msg}`);
    process.exit(1);
  }
}
