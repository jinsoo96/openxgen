/**
 * OPEN XGEN 메인 홈 — xgen 치면 나오는 인터랙티브 메뉴
 */
import chalk from "chalk";
import { createInterface } from "node:readline";
import { getAuth, getServer, getDefaultProvider } from "../config/store.js";
import { agentRepl } from "./agent.js";
import { chat } from "./chat.js";
import { guidedProviderSetup } from "./provider.js";

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function showStatus(): void {
  const provider = getDefaultProvider();
  const server = getServer();
  const auth = getAuth();

  console.log(chalk.gray("  ─────────────────────────────────"));
  console.log(chalk.gray("  상태:"));

  if (provider) {
    console.log(`    AI 에이전트  ${chalk.green("●")} ${provider.name} (${provider.model})`);
  } else {
    console.log(`    AI 에이전트  ${chalk.red("○")} 미설정`);
  }

  if (server && auth) {
    console.log(`    XGEN 서버   ${chalk.green("●")} ${server} (${auth.username})`);
  } else if (server) {
    console.log(`    XGEN 서버   ${chalk.yellow("○")} ${server} (로그인 필요)`);
  } else {
    console.log(`    XGEN 서버   ${chalk.red("○")} 미설정`);
  }
  console.log(chalk.gray("  ─────────────────────────────────\n"));
}

export async function homeMenu(): Promise<void> {
  const provider = getDefaultProvider();
  const server = getServer();
  const auth = getAuth();

  console.log(chalk.cyan(`
   ██████  ██████  ███████ ███    ██
  ██    ██ ██   ██ ██      ████   ██
  ██    ██ ██████  █████   ██ ██  ██
  ██    ██ ██      ██      ██  ██ ██
   ██████  ██      ███████ ██   ████`));
  console.log(chalk.white.bold(`
  ██   ██  ██████  ███████ ███    ██
   ██ ██  ██       ██      ████   ██
    ███   ██   ███ █████   ██ ██  ██
   ██ ██  ██    ██ ██      ██  ██ ██
  ██   ██  ██████  ███████ ██   ████`));
  console.log(chalk.gray(`                              v0.3.0\n`));

  showStatus();

  while (true) {
    // 메뉴 항목 동적 구성
    const items: { key: string; label: string; available: boolean; action: () => Promise<void> }[] = [];

    items.push({
      key: "1",
      label: provider
        ? `AI 에이전트 시작 ${chalk.gray(`(${provider.name})`)}`
        : `AI 에이전트 설정 + 시작`,
      available: true,
      action: async () => { await agentRepl(); },
    });

    if (server && auth) {
      items.push({
        key: "2",
        label: `워크플로우 채팅 ${chalk.gray(`(${auth.username}@${server.replace("https://","")})`)}`,
        available: true,
        action: async () => { await chat(); },
      });
      items.push({
        key: "3",
        label: "워크플로우 목록",
        available: true,
        action: async () => {
          const { workflowList } = await import("./workflow/list.js");
          await workflowList({ detail: false });
          return;
        },
      });
    } else {
      items.push({
        key: "2",
        label: "XGEN 서버 연결 + 로그인",
        available: true,
        action: async () => { await serverSetup(); },
      });
    }

    items.push({
      key: String(items.length + 1),
      label: "프로바이더 관리",
      available: true,
      action: async () => { await providerMenu(); },
    });

    items.push({
      key: String(items.length + 1),
      label: "설정 보기",
      available: true,
      action: async () => {
        showStatus();
        const cfg = await import("../config/store.js");
        const config = cfg.getConfig();
        console.log(chalk.gray("  설정 파일: ~/.xgen/\n"));
        console.log(chalk.gray(`    서버: ${config.server ?? "(없음)"}`));
        console.log(chalk.gray(`    테마: ${config.theme}`));
        console.log(chalk.gray(`    스트림 로그: ${config.streamLogs}\n`));
      },
    });

    items.push({
      key: "q",
      label: "종료",
      available: true,
      action: async () => { process.exit(0); },
    });

    // 메뉴 출력
    console.log(chalk.bold("  뭘 하시겠습니까?\n"));
    for (const item of items) {
      console.log(`    ${chalk.cyan(item.key + ")")} ${item.label}`);
    }
    console.log();

    const choice = await prompt(chalk.white("  선택: "));

    if (choice === "q" || choice === "exit") {
      console.log(chalk.gray("\n  안녕히.\n"));
      break;
    }

    const selected = items.find((i) => i.key === choice);
    if (!selected) {
      console.log(chalk.red("  잘못된 선택입니다.\n"));
      continue;
    }

    try {
      await selected.action();
    } catch (err) {
      console.log(chalk.red(`\n  오류: ${(err as Error).message}\n`));
    }

    // 에이전트나 채팅에서 돌아오면 다시 메뉴
    console.log();
    showStatus();
  }
}

async function serverSetup(): Promise<void> {
  console.log(chalk.cyan.bold("\n  XGEN 서버 연결\n"));

  const currentServer = getServer();
  const urlInput = await prompt(
    chalk.white(`  서버 URL${currentServer ? ` [${currentServer}]` : ""}: `)
  );
  const url = urlInput || currentServer;

  if (!url) {
    console.log(chalk.red("  URL이 필요합니다.\n"));
    return;
  }

  const { setServer } = await import("../config/store.js");
  setServer(url);
  console.log(chalk.green(`  ✓ 서버 설정: ${url}\n`));

  // 로그인
  console.log(chalk.bold("  로그인\n"));
  const email = await prompt(chalk.white("  이메일: "));
  const password = await prompt(chalk.white("  비밀번호: "));

  if (!email || !password) {
    console.log(chalk.red("  이메일과 비밀번호가 필요합니다.\n"));
    return;
  }

  try {
    const { apiLogin } = await import("../api/auth.js");
    const { setAuth } = await import("../config/store.js");
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
      console.log(chalk.green(`  ✓ 로그인 성공! ${result.username ?? email}\n`));
    } else {
      console.log(chalk.red(`  ✗ 로그인 실패: ${result.message}\n`));
    }
  } catch (err) {
    console.log(chalk.red(`  ✗ 로그인 실패: ${(err as Error).message}\n`));
  }
}

async function providerMenu(): Promise<void> {
  const { getProviders, getDefaultProvider: getDefault } = await import("../config/store.js");
  const providers = getProviders();
  const defaultP = getDefault();

  console.log(chalk.cyan.bold("\n  프로바이더 관리\n"));

  if (providers.length > 0) {
    for (const p of providers) {
      const mark = p.id === defaultP?.id ? chalk.green("● ") : chalk.gray("  ");
      console.log(`    ${mark}${p.name} ${chalk.gray(`(${p.type} — ${p.model})`)}`);
    }
    console.log();
  }

  console.log(`    ${chalk.cyan("1)")} 새 프로바이더 추가`);
  if (providers.length > 1) {
    console.log(`    ${chalk.cyan("2)")} 기본 프로바이더 변경`);
  }
  if (providers.length > 0) {
    console.log(`    ${chalk.cyan("3)")} 프로바이더 삭제`);
  }
  console.log(`    ${chalk.cyan("b)")} 돌아가기`);
  console.log();

  const choice = await prompt(chalk.white("  선택: "));

  if (choice === "1") {
    await guidedProviderSetup();
  } else if (choice === "2" && providers.length > 1) {
    console.log();
    providers.forEach((p, i) => {
      console.log(`    ${chalk.cyan(`${i + 1})`)} ${p.name} (${p.model})`);
    });
    console.log();
    const pc = await prompt(chalk.white("  번호: "));
    const pi = parseInt(pc) - 1;
    if (pi >= 0 && pi < providers.length) {
      const { setDefaultProvider: setDef } = await import("../config/store.js");
      setDef(providers[pi].id);
      console.log(chalk.green(`  ✓ 기본 프로바이더: ${providers[pi].name}\n`));
    }
  } else if (choice === "3" && providers.length > 0) {
    console.log();
    providers.forEach((p, i) => {
      console.log(`    ${chalk.cyan(`${i + 1})`)} ${p.name} (${p.model})`);
    });
    console.log();
    const dc = await prompt(chalk.white("  삭제할 번호: "));
    const di = parseInt(dc) - 1;
    if (di >= 0 && di < providers.length) {
      const { removeProvider: rmProv } = await import("../config/store.js");
      rmProv(providers[di].id);
      console.log(chalk.green(`  ✓ 삭제됨: ${providers[di].name}\n`));
    }
  }
}
