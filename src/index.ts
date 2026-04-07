#!/usr/bin/env node
/**
 * XGEN CLI — XGEN 2.0 플랫폼 + AI 코딩 에이전트
 *
 * xgen          → 설정에 따라 에이전트 또는 채팅 모드
 * xgen agent    → AI 코딩 에이전트
 * xgen chat     → XGEN 워크플로우 채팅
 * xgen wf run   → 워크플로우 실행
 */
import { Command } from "commander";
import chalk from "chalk";
import { registerConfigCommand } from "./commands/config.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerWorkflowCommand } from "./commands/workflow/index.js";
import { registerChatCommand, chat } from "./commands/chat.js";
import { registerProviderCommand } from "./commands/provider.js";
import { registerAgentCommand, agentRepl } from "./commands/agent.js";
import { registerDocCommand } from "./commands/doc.js";
import { registerOntologyCommand } from "./commands/ontology.js";
import { getAuth, getServer, getDefaultProvider } from "./config/store.js";

const VERSION = "2.4.0";

const LOGO = chalk.cyan(`
   ██████  ██████  ███████ ███    ██
  ██    ██ ██   ██ ██      ████   ██
  ██    ██ ██████  █████   ██ ██  ██
  ██    ██ ██      ██      ██  ██ ██
   ██████  ██      ███████ ██   ████
`) + chalk.white.bold(`
  ██   ██  ██████  ███████ ███    ██
   ██ ██  ██       ██      ████   ██
    ███   ██   ███ █████   ██ ██  ██
   ██ ██  ██    ██ ██      ██  ██ ██
  ██   ██  ██████  ███████ ██   ████
`) + chalk.gray(`                              v${VERSION}\n`);

const BANNER = LOGO;

const program = new Command();

program
  .name("xgen")
  .description("OPEN XGEN — AI Coding Agent + XGEN Platform CLI")
  .version(VERSION)
  .addHelpText("before", BANNER)
  .addHelpText(
    "after",
    `
${chalk.bold("시작하기:")}
  ${chalk.cyan("xgen provider add")}               AI 프로바이더 설정
  ${chalk.cyan("xgen agent")}                      AI 코딩 에이전트
  ${chalk.cyan("xgen config set-server")} <url>    XGEN 서버 연결
  ${chalk.cyan("xgen login")}                      서버 로그인

${chalk.bold("AI 에이전트:")}
  ${chalk.cyan("xgen agent")}                      코딩 에이전트 (파일, 터미널, 검색)
  ${chalk.cyan("xgen provider ls")}                프로바이더 목록
  ${chalk.cyan("xgen provider add")}               프로바이더 추가

${chalk.bold("XGEN 플랫폼:")}
  ${chalk.cyan("xgen dash")}                       TUI 대시보드 (조회/테스트/생성)
  ${chalk.cyan("xgen chat")}                       워크플로우 대화
  ${chalk.cyan("xgen wf ls")}                      워크플로우 목록
  ${chalk.cyan("xgen wf run")} <id> "질문"         워크플로우 실행
  ${chalk.cyan("xgen doc ls")}                     문서 목록
  ${chalk.cyan("xgen ont query")} "질문"           온톨로지 질의

${chalk.bold("대시보드 (xgen dash):")}
  ${chalk.gray("↑↓")} 이동  ${chalk.gray("Enter")} 상세/실행  ${chalk.gray("1-6")} 탭전환  ${chalk.gray("r")} 새로고침  ${chalk.gray("q")} 종료
  ${chalk.gray("c")} 생성  ${chalk.gray("e")} 수정  ${chalk.gray("d")} 삭제  ${chalk.gray("t")} 테스트  ${chalk.gray("u")} 스토어등록  ${chalk.gray("v")} 버전
  탭: 워크플로우 컬렉션 노드 프롬프트 도구 MCP
`
  );

// 커맨드 등록
registerConfigCommand(program);
registerLoginCommand(program);
registerWorkflowCommand(program);
registerChatCommand(program);
registerProviderCommand(program);
registerAgentCommand(program);
registerDocCommand(program);
registerOntologyCommand(program);

// 대시보드 커맨드
program
  .command("dash")
  .alias("dashboard")
  .description("XGEN TUI 대시보드")
  .action(async () => {
    // Commander가 stdin 리스너를 등록했을 수 있으므로 전부 해제
    process.stdin.removeAllListeners();
    process.stdin.pause();
    // stdin 버퍼 비우기 — 명령줄 Enter 잔여 입력 제거
    await new Promise(r => setTimeout(r, 50));
    const { startRawTui } = await import("./dashboard/raw-tui.js");
    await startRawTui();
  });

// 인자 없이 실행: 바로 AI 채팅 (Claude Code 스타일)
if (process.argv.length <= 2) {
  agentRepl().catch((err) => {
    console.error(chalk.red(`오류: ${err.message}`));
    process.exit(1);
  });
} else {
  program.parse();
}
