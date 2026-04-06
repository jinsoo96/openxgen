/**
 * OPEN XGEN 홈 — 메인 인터랙티브 허브
 */
import chalk from "chalk";
import { getAuth, getServer, getDefaultProvider, getProviders } from "../config/store.js";
import { welcome, box, divider, statusDot, menu, ask } from "../utils/ui.js";
import { agentRepl } from "./agent.js";
import { chat } from "./chat.js";
import { guidedProviderSetup } from "./provider.js";

function showStatus(): void {
  const provider = getDefaultProvider();
  const server = getServer();
  const auth = getAuth();

  console.log(divider("상태"));
  console.log();

  if (provider) {
    console.log(statusDot(true, chalk.bold("AI 에이전트"), `${provider.name} · ${provider.model}`));
  } else {
    console.log(statusDot(false, "AI 에이전트", "미설정"));
  }

  if (server && auth) {
    console.log(statusDot(true, chalk.bold("XGEN 서버"), `${auth.username} · ${server.replace("https://", "")}`));
  } else if (server) {
    console.log(statusDot(false, "XGEN 서버", `${server.replace("https://", "")} · 로그인 필요`));
  } else {
    console.log(statusDot(false, "XGEN 서버", "미연결"));
  }
  console.log();
}

export async function homeMenu(): Promise<void> {
  console.log(welcome());
  console.log(chalk.gray("                              v0.3.2\n"));

  showStatus();

  while (true) {
    const provider = getDefaultProvider();
    const server = getServer();
    const auth = getAuth();
    const hasServer = !!(server && auth);

    // 동적 메뉴 구성
    const items: { label: string; hint: string; action: () => Promise<boolean> }[] = [];

    // AI 에이전트
    items.push({
      label: provider
        ? `${chalk.bold("AI 에이전트")} ${chalk.gray(`(${provider.model})`)}`
        : chalk.bold("AI 에이전트 시작하기"),
      hint: provider ? "대화 시작" : "프로바이더 설정 → 바로 시작",
      action: async () => {
        await agentRepl();
        console.log();
        showStatus();
        return false;
      },
    });

    // 워크플로우
    if (hasServer) {
      items.push({
        label: chalk.bold("워크플로우 채팅"),
        hint: `${auth!.username}@${server!.replace("https://", "")}`,
        action: async () => {
          await chat();
          console.log();
          showStatus();
          return false;
        },
      });

      items.push({
        label: "워크플로우 목록",
        hint: "조회",
        action: async () => {
          const { workflowList } = await import("./workflow/list.js");
          await workflowList({ detail: false });
          return false;
        },
      });
    }

    // 서버 연결
    items.push({
      label: hasServer ? "XGEN 서버 재설정" : chalk.bold("XGEN 서버 연결"),
      hint: hasServer ? "서버 변경 / 재로그인" : "서버 URL + 로그인",
      action: async () => {
        await serverSetup();
        showStatus();
        return false;
      },
    });

    // 프로바이더 관리
    items.push({
      label: "프로바이더 관리",
      hint: `${getProviders().length}개 등록됨`,
      action: async () => {
        await providerMenu();
        showStatus();
        return false;
      },
    });

    // 메뉴 출력
    console.log(divider("메뉴"));
    for (let i = 0; i < items.length; i++) {
      const num = chalk.cyan.bold(` ${String(i + 1).padStart(2)}.`);
      console.log(`  ${num} ${items[i].label}`);
      console.log(`      ${chalk.gray(items[i].hint)}`);
    }
    console.log(`  ${chalk.gray("   q. 종료")}`);
    console.log();

    const choice = await ask(chalk.cyan("  ❯ "));

    if (choice === "q" || choice === "exit" || choice === "") {
      if (choice === "") continue;
      console.log(chalk.gray("\n  👋 다음에 또.\n"));
      break;
    }

    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= items.length) {
      console.log(chalk.red(`  잘못된 입력입니다.\n`));
      continue;
    }

    try {
      const shouldExit = await items[idx].action();
      if (shouldExit) break;
    } catch (err) {
      console.log(chalk.red(`\n  오류: ${(err as Error).message}\n`));
    }
  }
}

async function serverSetup(): Promise<void> {
  console.log();
  console.log(box(["XGEN 서버 연결"], "cyan"));
  console.log();

  const currentServer = getServer();
  const urlInput = await ask(
    chalk.white(`  서버 URL${currentServer ? chalk.gray(` [${currentServer}]`) : ""}: `)
  );
  const url = urlInput || currentServer;

  if (!url) {
    console.log(chalk.red("  URL이 필요합니다.\n"));
    return;
  }

  const { setServer } = await import("../config/store.js");
  setServer(url);
  console.log(chalk.green(`  ✓ 서버: ${url}\n`));

  // 로그인
  console.log(chalk.bold("  로그인"));
  console.log();
  const email = await ask(chalk.white("  이메일: "));
  const password = await ask(chalk.white("  비밀번호: "));

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
      console.log(chalk.green(`\n  ✓ 로그인 성공! ${chalk.bold(result.username ?? email)}\n`));
    } else {
      console.log(chalk.red(`\n  ✗ ${result.message}\n`));
    }
  } catch (err) {
    console.log(chalk.red(`\n  ✗ ${(err as Error).message}\n`));
  }
}

async function providerMenu(): Promise<void> {
  const providers = getProviders();
  const defaultP = getDefaultProvider();

  console.log();
  console.log(box(["프로바이더 관리"], "cyan"));
  console.log();

  if (providers.length > 0) {
    for (const p of providers) {
      const mark = p.id === defaultP?.id ? chalk.green("● ") : chalk.gray("  ");
      console.log(`    ${mark}${chalk.bold(p.name)} ${chalk.gray(`${p.type} · ${p.model}`)}`);
    }
    console.log();
  } else {
    console.log(chalk.gray("    등록된 프로바이더가 없습니다.\n"));
  }

  const items = ["새로 추가"];
  if (providers.length > 1) items.push("기본 변경");
  if (providers.length > 0) items.push("삭제");
  items.push("돌아가기");

  items.forEach((item, i) => {
    console.log(`    ${chalk.cyan(`${i + 1}.`)} ${item}`);
  });
  console.log();

  const choice = await ask(chalk.cyan("  ❯ "));
  const ci = parseInt(choice);

  if (ci === 1) {
    await guidedProviderSetup();
  } else if (items[ci - 1] === "기본 변경") {
    console.log();
    providers.forEach((p, i) => {
      console.log(`    ${chalk.cyan(`${i + 1}.`)} ${p.name} (${p.model})`);
    });
    console.log();
    const pc = await ask(chalk.cyan("  ❯ "));
    const pi = parseInt(pc) - 1;
    if (pi >= 0 && pi < providers.length) {
      const { setDefaultProvider } = await import("../config/store.js");
      setDefaultProvider(providers[pi].id);
      console.log(chalk.green(`  ✓ 기본: ${providers[pi].name}\n`));
    }
  } else if (items[ci - 1] === "삭제") {
    console.log();
    providers.forEach((p, i) => {
      console.log(`    ${chalk.cyan(`${i + 1}.`)} ${p.name} (${p.model})`);
    });
    console.log();
    const dc = await ask(chalk.white("  삭제할 번호: "));
    const di = parseInt(dc) - 1;
    if (di >= 0 && di < providers.length) {
      const { removeProvider } = await import("../config/store.js");
      removeProvider(providers[di].id);
      console.log(chalk.green(`  ✓ 삭제: ${providers[di].name}\n`));
    }
  }
}
