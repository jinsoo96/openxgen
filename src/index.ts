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

const VERSION = "0.3.0";

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
  ${chalk.cyan("xgen chat")}                       워크플로우 대화
  ${chalk.cyan("xgen wf ls")}                      워크플로우 목록
  ${chalk.cyan("xgen wf run")} <id> "질문"         워크플로우 실행
  ${chalk.cyan("xgen doc ls")}                     문서 목록
  ${chalk.cyan("xgen ont query")} "질문"           온톨로지 질의
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

// 인자 없이 실행: 상황에 따라 라우팅
if (process.argv.length <= 2) {
  const auth = getAuth();
  const server = getServer();
  const provider = getDefaultProvider();

  if (provider) {
    // 프로바이더 있으면 → 에이전트 모드
    agentRepl().catch((err) => {
      console.error(chalk.red(`오류: ${err.message}`));
      process.exit(1);
    });
  } else if (auth && server) {
    // XGEN 서버 로그인 되어있으면 → 채팅 모드
    chat().catch((err) => {
      console.error(chalk.red(`오류: ${err.message}`));
      process.exit(1);
    });
  } else {
    // 아무것도 없으면 → 안내
    console.log(BANNER);
    console.log(chalk.yellow("  설정이 필요합니다.\n"));
    console.log(chalk.bold("  AI 에이전트:"));
    console.log(`    ${chalk.cyan("xgen provider add")}    프로바이더 추가\n`);
    console.log(chalk.bold("  XGEN 플랫폼:"));
    console.log(`    ${chalk.cyan("xgen config set-server")} <url>  서버 설정`);
    console.log(`    ${chalk.cyan("xgen login")}                   로그인\n`);
  }
} else {
  program.parse();
}
