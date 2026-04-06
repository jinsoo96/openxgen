/**
 * xgen config — 설정 관리
 */
import { Command } from "commander";
import chalk from "chalk";
import { getConfig, setServer, getServer, setConfig } from "../config/store.js";
import { resetClient } from "../api/client.js";
import { printSuccess, printError, printKeyValue } from "../utils/format.js";

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("XGEN CLI 설정 관리");

  config
    .command("set-server <url>")
    .description("XGEN 서버 URL 설정")
    .action((url: string) => {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        printError("URL은 http:// 또는 https://로 시작해야 합니다");
        process.exit(1);
      }
      setServer(url);
      resetClient();
      printSuccess(`서버 설정 완료: ${chalk.underline(url)}`);
    });

  config
    .command("get-server")
    .description("현재 설정된 서버 URL 확인")
    .action(() => {
      const server = getServer();
      if (server) {
        console.log(server);
      } else {
        printError("서버가 설정되지 않았습니다");
        console.log("  설정: xgen config set-server <url>");
      }
    });

  config
    .command("list")
    .description("전체 설정 확인")
    .action(() => {
      const cfg = getConfig();
      console.log(chalk.bold("\nXGEN CLI 설정"));
      console.log(chalk.gray("─".repeat(40)));
      printKeyValue("서버", cfg.server);
      printKeyValue("기본 워크플로우", cfg.defaultWorkflow);
      printKeyValue("테마", cfg.theme);
      printKeyValue("스트림 로그", String(cfg.streamLogs));
      console.log();
    });

  config
    .command("set <key> <value>")
    .description("설정 값 변경")
    .action((key: string, value: string) => {
      const allowedKeys = ["defaultWorkflow", "theme", "streamLogs"];
      if (!allowedKeys.includes(key)) {
        printError(`알 수 없는 설정 키: ${key}`);
        console.log(`  사용 가능: ${allowedKeys.join(", ")}`);
        process.exit(1);
      }

      const parsed = key === "streamLogs" ? value === "true" : value;
      setConfig({ [key]: parsed });
      printSuccess(`${key} = ${value}`);
    });
}
