/**
 * xgen chat — 인터랙티브 터미널 모드
 *
 * Gemini CLI 스타일: 터미널 열면 바로 대화, 워크플로우 전환 가능
 *
 * 슬래시 커맨드:
 *   /workflows  — 워크플로우 목록 + 전환
 *   /switch     — 워크플로우 전환
 *   /history    — 최근 대화 이력
 *   /clear      — 화면 지우기
 *   /help       — 도움말
 *   /exit       — 종료
 */
import chalk from "chalk";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { requireAuth, getAuth, getServer } from "../config/store.js";
import { listWorkflows, executeWorkflowStream, type Workflow } from "../api/workflow.js";
import { parseSSEStream } from "../utils/sse.js";
import { renderMarkdown } from "../utils/markdown.js";
import { printError } from "../utils/format.js";
import type { SSEEvent } from "../api/types.js";

const CHAT_BANNER = `
${chalk.cyan("╭──────────────────────────────────────╮")}
${chalk.cyan("│")} ${chalk.white.bold("XGEN")} ${chalk.gray("— 워크플로우 AI 터미널")}          ${chalk.cyan("│")}
${chalk.cyan("│")} ${chalk.gray("/help 도움말  /workflows 전환  /exit")} ${chalk.cyan("│")}
${chalk.cyan("╰──────────────────────────────────────╯")}`;

function printHelp() {
  console.log(`
${chalk.bold("슬래시 커맨드")}
  ${chalk.cyan("/workflows")}    워크플로우 목록 보기 & 전환
  ${chalk.cyan("/switch")}       워크플로우 번호로 전환 (예: /switch 3)
  ${chalk.cyan("/history")}      현재 세션 대화 이력
  ${chalk.cyan("/clear")}        화면 지우기
  ${chalk.cyan("/info")}         현재 연결 정보
  ${chalk.cyan("/help")}         이 도움말
  ${chalk.cyan("/exit")}         종료 (Ctrl+C도 가능)
`);
}

async function promptLine(rl: ReturnType<typeof createInterface>, promptStr: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(promptStr, (answer) => resolve(answer));
  });
}

export async function chat(workflowId?: string): Promise<void> {
  const auth = requireAuth();
  const server = getServer();

  // 워크플로우 목록 로드
  let workflows: Workflow[] = [];
  try {
    workflows = await listWorkflows();
  } catch {
    printError("워크플로우 목록을 불러올 수 없습니다");
    process.exit(1);
  }

  if (workflows.length === 0) {
    printError("사용 가능한 워크플로우가 없습니다");
    process.exit(1);
  }

  // 워크플로우 선택
  let current: Workflow;
  if (workflowId) {
    const found = workflows.find((w) => w.id === workflowId || w.workflow_name === workflowId);
    current = found ?? { id: workflowId, workflow_name: workflowId };
  } else {
    // 첫 번째 또는 선택
    console.log(CHAT_BANNER);
    console.log(chalk.gray(`  서버: ${server}  |  사용자: ${auth.username}\n`));
    console.log(chalk.bold("  워크플로우 선택:\n"));
    workflows.forEach((w, i) => {
      console.log(`  ${chalk.cyan(String(i + 1).padStart(3))}  ${w.workflow_name}`);
    });
    console.log();

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await promptLine(rl, chalk.cyan("  번호> "));
    rl.close();

    const idx = parseInt(answer.trim()) - 1;
    if (isNaN(idx) || idx < 0 || idx >= workflows.length) {
      current = workflows[0];
    } else {
      current = workflows[idx];
    }
  }

  // 세션 시작
  const sessionId = randomUUID().slice(0, 8);
  let turnCount = 0;
  const history: Array<{ role: string; content: string }> = [];

  console.log();
  console.log(chalk.cyan("─".repeat(42)));
  console.log(chalk.white.bold(`  ${current.workflow_name}`));
  console.log(chalk.cyan("─".repeat(42)));
  console.log(chalk.gray("  메시지를 입력하세요. /help 로 도움말.\n"));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const getPrompt = () => chalk.cyan("❯ ");

  const processInput = async (line: string) => {
    const input = line.trim();
    if (!input) return;

    // 슬래시 커맨드
    if (input.startsWith("/")) {
      const [cmd, ...args] = input.slice(1).split(" ");

      switch (cmd.toLowerCase()) {
        case "exit":
        case "quit":
        case "q":
          console.log(chalk.gray("\n  종료합니다.\n"));
          rl.close();
          process.exit(0);
          break;

        case "help":
        case "h":
          printHelp();
          break;

        case "clear":
        case "cls":
          console.clear();
          console.log(chalk.white.bold(`  ${current.workflow_name}`));
          console.log(chalk.cyan("─".repeat(42)));
          break;

        case "workflows":
        case "wf":
          console.log();
          workflows.forEach((w, i) => {
            const marker = w.id === current.id ? chalk.green("▸") : " ";
            console.log(`  ${marker} ${chalk.cyan(String(i + 1).padStart(2))}  ${w.workflow_name}`);
          });
          console.log(chalk.gray("\n  /switch <번호> 로 전환\n"));
          break;

        case "switch":
        case "sw": {
          const num = parseInt(args[0]);
          if (isNaN(num) || num < 1 || num > workflows.length) {
            console.log(chalk.yellow(`  1~${workflows.length} 사이 번호를 입력하세요`));
          } else {
            current = workflows[num - 1];
            turnCount = 0;
            history.length = 0;
            console.log(chalk.green(`\n  전환: ${current.workflow_name}\n`));
          }
          break;
        }

        case "history":
        case "hist":
          if (history.length === 0) {
            console.log(chalk.gray("  대화 이력이 없습니다.\n"));
          } else {
            console.log();
            for (const h of history) {
              const label = h.role === "user" ? chalk.cyan("나") : chalk.green("AI");
              const text = h.content.length > 80 ? h.content.slice(0, 80) + "..." : h.content;
              console.log(`  ${label}: ${text}`);
            }
            console.log();
          }
          break;

        case "info":
          console.log(`
  ${chalk.gray("서버:")}     ${server}
  ${chalk.gray("사용자:")}   ${auth.username}
  ${chalk.gray("워크플로우:")} ${current.workflow_name}
  ${chalk.gray("세션:")}     ${sessionId}
  ${chalk.gray("턴:")}       ${turnCount}
`);
          break;

        default:
          console.log(chalk.yellow(`  알 수 없는 커맨드: /${cmd}. /help 참고`));
      }

      rl.prompt();
      return;
    }

    // 워크플로우 실행
    turnCount++;
    const interactionId = `${sessionId}_t${turnCount}`;
    history.push({ role: "user", content: input });

    // 스피너 시작
    process.stdout.write(chalk.gray("  thinking..."));

    try {
      const stream = await executeWorkflowStream({
        workflow_id: current.id,
        workflow_name: current.workflow_name,
        input_data: input,
        interaction_id: interactionId,
      });

      // 스피너 지우기
      process.stdout.write("\r" + " ".repeat(20) + "\r");

      let fullResponse = "";
      let hasOutput = false;

      await parseSSEStream(
        stream,
        (event: SSEEvent) => {
          if ((event.type === "token" || !event.type) && event.content) {
            if (!hasOutput) {
              hasOutput = true;
              console.log();
            }
            process.stdout.write(event.content);
            fullResponse += event.content;
          } else if (event.type === "error") {
            process.stdout.write("\r" + " ".repeat(20) + "\r");
            printError(event.error ?? event.content ?? "오류");
          }
        },
        () => {
          if (hasOutput) {
            // 응답 끝 — 마크다운 렌더링은 전체 텍스트에 적용
            console.log();
            console.log();
          }
          if (fullResponse) {
            history.push({ role: "assistant", content: fullResponse });
          }
        },
        (err) => {
          process.stdout.write("\r" + " ".repeat(20) + "\r");
          printError(`스트리밍 오류: ${err.message}`);
        }
      );
    } catch (err: unknown) {
      process.stdout.write("\r" + " ".repeat(20) + "\r");
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? (err as Error).message;
      printError(`실행 실패: ${msg}`);
    }

    rl.prompt();
  };

  rl.setPrompt(getPrompt());
  rl.prompt();

  rl.on("line", (line) => {
    // async 처리 — 입력 비활성화 후 완료되면 다시 prompt
    processInput(line).then(() => {
      // prompt는 processInput 내부에서 호출
    });
  });

  rl.on("close", () => {
    console.log(chalk.gray("\n  종료합니다.\n"));
    process.exit(0);
  });

  // Ctrl+C 깔끔하게
  process.on("SIGINT", () => {
    console.log(chalk.gray("\n  종료합니다.\n"));
    process.exit(0);
  });
}

export function registerChatCommand(program: import("commander").Command): void {
  program
    .command("chat [workflow-id]")
    .description("인터랙티브 대화 모드")
    .action((workflowId) => chat(workflowId));
}
