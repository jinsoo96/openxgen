/**
 * xgen login — 서버 로그인
 */
import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline";
import { apiLogin } from "../api/auth.js";
import { setAuth, requireServer, getAuth } from "../config/store.js";
import { printSuccess, printError, printHeader } from "../utils/format.js";

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hidden) {
      // 비밀번호 입력 시 에코 숨김
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.isTTY) stdin.setRawMode(true);

      let password = "";
      const onData = (ch: Buffer) => {
        const c = ch.toString("utf8");
        if (c === "\n" || c === "\r" || c === "\u0004") {
          if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          rl.close();
          resolve(password);
        } else if (c === "\u0003") {
          // Ctrl+C
          process.exit(0);
        } else if (c === "\u007F" || c === "\b") {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          password += c;
          process.stdout.write("*");
        }
      };
      stdin.on("data", onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("XGEN 서버에 로그인")
    .option("-e, --email <email>", "이메일")
    .option("-p, --password <password>", "비밀번호")
    .action(async (opts) => {
      const server = requireServer();

      printHeader("XGEN Login");
      console.log(chalk.gray(`서버: ${server}\n`));

      let email = opts.email;
      let password = opts.password;

      if (!email) {
        email = await prompt(chalk.white("이메일: "));
      }
      if (!password) {
        password = await prompt(chalk.white("비밀번호: "), true);
      }

      if (!email || !password) {
        printError("이메일과 비밀번호를 모두 입력하세요");
        process.exit(1);
      }

      try {
        const result = await apiLogin(email, password);

        if (result.success && result.access_token) {
          setAuth({
            accessToken: result.access_token,
            refreshToken: result.refresh_token ?? "",
            userId: result.user_id ?? "",
            username: result.username ?? "",
            isAdmin: false,
            expiresAt: null,
          });

          console.log();
          printSuccess(`로그인 성공! ${chalk.bold(result.username ?? email)}`);
        } else {
          printError(result.message || "로그인 실패");
          process.exit(1);
        }
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string; detail?: string } } })
            ?.response?.data?.message ??
          (err as { response?: { data?: { detail?: string } } })
            ?.response?.data?.detail ??
          (err as Error).message;
        printError(`로그인 실패: ${msg}`);
        process.exit(1);
      }
    });

  program
    .command("logout")
    .description("로그아웃")
    .action(async () => {
      const { clearAuth } = await import("../config/store.js");
      clearAuth();
      printSuccess("로그아웃 완료");
    });

  program
    .command("whoami")
    .description("현재 로그인된 사용자 정보")
    .action(async () => {
      const auth = getAuth();
      if (!auth) {
        printError("로그인되지 않았습니다. xgen login 실행하세요");
        process.exit(1);
      }

      const server = requireServer();
      console.log(chalk.bold("\n현재 사용자"));
      console.log(chalk.gray("─".repeat(30)));
      console.log(`  ${chalk.gray("서버:")} ${server}`);
      console.log(`  ${chalk.gray("사용자:")} ${chalk.bold(auth.username)}`);
      console.log(`  ${chalk.gray("User ID:")} ${auth.userId}`);

      // 토큰 유효성 확인
      try {
        const { apiValidate } = await import("../api/auth.js");
        const result = await apiValidate(auth.accessToken);
        if (result.valid) {
          console.log(`  ${chalk.gray("상태:")} ${chalk.green("활성")}`);
          if (result.is_admin) {
            console.log(`  ${chalk.gray("권한:")} ${chalk.yellow("관리자")}`);
          }
          if (result.user_type) {
            console.log(`  ${chalk.gray("유형:")} ${result.user_type}`);
          }
        } else {
          console.log(`  ${chalk.gray("상태:")} ${chalk.red("토큰 만료")}`);
        }
      } catch {
        console.log(`  ${chalk.gray("상태:")} ${chalk.yellow("검증 불가 (서버 연결 실패)")}`);
      }
      console.log();
    });
}
