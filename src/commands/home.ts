/**
 * OPEN XGEN 홈 — 메인 인터랙티브 허브
 */
import chalk from "chalk";
import { getAuth, getServer, getDefaultProvider, getProviders, getEnvironments, getActiveEnvironment, switchEnvironment, addEnvironment, removeEnvironment, type XgenEnvironment } from "../config/store.js";
import { welcome, box, divider, statusDot, ask } from "../utils/ui.js";
import { agentRepl } from "./agent.js";
import { chat } from "./chat.js";
import { guidedProviderSetup } from "./provider.js";

function showStatus(): void {
  const provider = getDefaultProvider();
  const server = getServer();
  const auth = getAuth();
  const activeEnv = getActiveEnvironment();
  const envs = getEnvironments();

  console.log(divider("상태"));
  console.log();
  console.log(provider
    ? statusDot(true, chalk.bold("AI 에이전트"), `${provider.name} · ${provider.model}`)
    : statusDot(false, "AI 에이전트", "미설정"));
  console.log(server && auth
    ? statusDot(true, chalk.bold("XGEN 서버"), `${auth.username} · ${server.replace("https://", "")}`)
    : server
      ? statusDot(false, "XGEN 서버", `${server.replace("https://", "")} · 로그인 필요`)
      : statusDot(false, "XGEN 서버", "미연결"));
  if (activeEnv) {
    console.log(statusDot(true, chalk.bold("환경"), `${activeEnv.name} (${envs.length}개 등록)`));
  } else if (envs.length > 0) {
    console.log(statusDot(false, "환경", `${envs.length}개 등록`));
  }
  console.log();
}

export async function homeMenu(): Promise<void> {
  console.log(welcome());
  console.log(chalk.gray("                              v0.4.1\n"));
  showStatus();

  while (true) {
    const provider = getDefaultProvider();
    const server = getServer();
    const auth = getAuth();
    const hasServer = !!(server && auth);

    type Item = { label: string; hint: string; key: string; action: () => Promise<void> };
    const items: Item[] = [];

    // ── AI 에이전트 ──
    items.push({
      key: "a", label: chalk.bold("AI 에이전트"),
      hint: provider ? `${provider.model} · 대화 시작` : "프로바이더 설정 후 시작",
      action: async () => { await agentRepl(); console.log(); showStatus(); },
    });

    // ── XGEN 플랫폼 (서버 연결 시) ──
    if (hasServer) {
      items.push({
        key: "c", label: chalk.bold("워크플로우 채팅"),
        hint: `${auth!.username}@${server!.replace("https://", "")}`,
        action: async () => { await chat(); console.log(); showStatus(); },
      });

      items.push({
        key: "w", label: "워크플로우 관리",
        hint: "목록 조회 → 선택 → 실행/정보",
        action: async () => {
          const { getWorkflowListDetail } = await import("../api/workflow.js");
          const wfs = await getWorkflowListDetail();
          if (!wfs.length) {
            console.log(chalk.yellow("\n  워크플로우가 없습니다.\n"));
            return;
          }
          console.log(chalk.bold(`\n  워크플로우 (${wfs.length}개)\n`));
          wfs.forEach((w, i) => {
            const id = (w.workflow_id ?? w.id ?? "").toString();
            const deployed = (w as Record<string, unknown>).is_deployed;
            const tag = deployed ? chalk.green(" [배포]") : "";
            console.log(`    ${chalk.cyan(`${String(i + 1).padStart(3)}.`)} ${w.workflow_name}${tag}`);
            console.log(`         ${chalk.gray(id)}`);
          });
          console.log();
          console.log(chalk.gray("  번호 입력 → 실행 / Enter → 돌아가기"));
          const choice = await ask(chalk.cyan("\n  ❯ "));
          if (!choice) return;
          const wi = parseInt(choice) - 1;
          if (wi < 0 || wi >= wfs.length) return;
          const selected = wfs[wi];
          const wfId = (selected.workflow_id ?? selected.id ?? "").toString();
          console.log(chalk.green(`\n  ✓ ${selected.workflow_name}\n`));
          const input = await ask(chalk.white("  메시지: "));
          if (!input) return;
          // deploy 된 워크플로우면 deploy 엔드포인트, 아니면 non-stream
          const deployKey = (selected as Record<string, unknown>).deploy_key as string | undefined;
          const isDeployed = (selected as Record<string, unknown>).is_deployed;
          try {
            console.log(chalk.gray("\n  실행 중...\n"));
            const { executeWorkflow } = await import("../api/workflow.js");
            const { randomUUID } = await import("node:crypto");
            const result = await executeWorkflow({
              workflow_id: wfId,
              workflow_name: selected.workflow_name,
              input_data: input,
              interaction_id: `cli_${randomUUID().slice(0, 8)}`,
              deploy_key: isDeployed && deployKey ? deployKey : undefined,
            }) as Record<string, unknown>;
            if (result.content) {
              console.log(chalk.bold("  응답:"));
              console.log(`  ${result.content}\n`);
            } else if (result.success === false) {
              console.log(chalk.red(`  오류: ${result.error ?? result.message}\n`));
            } else {
              console.log(chalk.gray(JSON.stringify(result, null, 2).slice(0, 500)));
              console.log();
            }
          } catch (err) {
            console.log(chalk.red(`  실행 실패: ${(err as Error).message}\n`));
          }
        },
      });

      items.push({
        key: "d", label: "문서 관리",
        hint: "문서 목록 조회",
        action: async () => {
          try {
            const { listDocuments } = await import("../api/document.js");
            const docs = await listDocuments();
            if (!docs.length) {
              console.log(chalk.yellow("\n  문서가 없습니다.\n"));
              return;
            }
            console.log(chalk.bold(`\n  문서 (${docs.length}개)\n`));
            docs.forEach((d, i) => {
              console.log(`    ${chalk.cyan(`${i + 1}.`)} ${d.file_name ?? d.name ?? "-"} ${chalk.gray(d.file_type ?? "")}`);
            });
            console.log();
          } catch (err) {
            console.log(chalk.red(`  오류: ${(err as Error).message}\n`));
          }
        },
      });

      items.push({
        key: "o", label: "온톨로지 질의",
        hint: "GraphRAG 원샷 질의",
        action: async () => {
          const question = await ask(chalk.white("\n  질문: "));
          if (!question) return;
          try {
            console.log(chalk.gray("  질의 중...\n"));
            const { queryGraphRAG } = await import("../api/ontology.js");
            const result = await queryGraphRAG(question);
            if (result.answer) {
              console.log(chalk.bold("  답변:"));
              console.log(`  ${result.answer}`);
            }
            if (result.sources?.length) {
              console.log(chalk.bold("\n  출처:"));
              result.sources.forEach((s) => console.log(chalk.gray(`    - ${s}`)));
            }
            console.log();
          } catch (err) {
            console.log(chalk.red(`  오류: ${(err as Error).message}\n`));
          }
        },
      });

      items.push({
        key: "h", label: "실행 이력",
        hint: "워크플로우 실행 이력",
        action: async () => {
          try {
            const { getIOLogs } = await import("../api/workflow.js");
            const logs = await getIOLogs(undefined, 10);
            if (!logs.length) {
              console.log(chalk.yellow("\n  실행 이력이 없습니다.\n"));
              return;
            }
            console.log(chalk.bold(`\n  최근 실행 이력 (${logs.length}개)\n`));
            logs.forEach((log, i) => {
              console.log(`    ${chalk.cyan(`${i + 1}.`)} ${chalk.gray(log.created_at ?? "-")}`);
              console.log(`       입력: ${(log.input_data ?? "").slice(0, 50)}`);
              console.log(`       출력: ${chalk.gray((log.output_data ?? "").slice(0, 50))}`);
            });
            console.log();
          } catch (err) {
            console.log(chalk.red(`  오류: ${(err as Error).message}\n`));
          }
        },
      });
    }

    // ── 설정 ──
    items.push({
      key: "s", label: hasServer ? "서버 재설정" : chalk.bold("XGEN 서버 연결"),
      hint: hasServer ? "서버 변경 / 재로그인" : "URL + 로그인",
      action: async () => { await serverSetup(); showStatus(); },
    });

    items.push({
      key: "p", label: "프로바이더 관리",
      hint: `${getProviders().length}개 등록`,
      action: async () => { await providerMenu(); showStatus(); },
    });

    items.push({
      key: "e", label: "환경 관리",
      hint: `${getEnvironments().length}개 등록 — 서버 전환`,
      action: async () => { await environmentMenu(); showStatus(); },
    });

    // ── 메뉴 출력 ──
    console.log(divider("메뉴"));
    console.log();

    if (hasServer) {
      console.log(chalk.gray("  AI"));
    }
    const aiItem = items.find((i) => i.key === "a")!;
    console.log(`    ${chalk.cyan.bold(aiItem.key + ".")} ${aiItem.label} ${chalk.gray("— " + aiItem.hint)}`);

    if (hasServer) {
      console.log();
      console.log(chalk.gray("  XGEN 플랫폼"));
      for (const item of items.filter((i) => ["c", "w", "r", "d", "o", "h"].includes(i.key))) {
        console.log(`    ${chalk.cyan.bold(item.key + ".")} ${item.label} ${chalk.gray("— " + item.hint)}`);
      }
    }

    console.log();
    console.log(chalk.gray("  설정"));
    for (const item of items.filter((i) => ["s", "p", "e"].includes(i.key))) {
      console.log(`    ${chalk.cyan.bold(item.key + ".")} ${item.label} ${chalk.gray("— " + item.hint)}`);
    }

    console.log(`    ${chalk.gray("q. 종료")}`);
    console.log();

    const choice = await ask(chalk.cyan("  ❯ "));

    if (choice === "q" || choice === "exit") {
      console.log(chalk.gray("\n  👋\n"));
      break;
    }
    if (!choice) continue;

    const selected = items.find((i) => i.key === choice);
    if (!selected) {
      console.log(chalk.red(`  "${choice}" — 잘못된 입력\n`));
      continue;
    }

    try {
      await selected.action();
    } catch (err) {
      console.log(chalk.red(`\n  오류: ${(err as Error).message}\n`));
    }
  }
}

async function serverSetup(): Promise<void> {
  console.log();
  console.log(box(["XGEN 서버 연결"]));
  console.log();

  const currentServer = getServer();
  const urlInput = await ask(
    chalk.white(`  서버 URL${currentServer ? chalk.gray(` [${currentServer}]`) : ""}: `)
  );
  const url = urlInput || currentServer;
  if (!url) { console.log(chalk.red("  URL 필요.\n")); return; }

  const { setServer } = await import("../config/store.js");
  setServer(url);
  console.log(chalk.green(`  ✓ ${url}\n`));

  const email = await ask(chalk.white("  이메일: "));
  const password = await ask(chalk.white("  비밀번호: "));
  if (!email || !password) { console.log(chalk.red("  필요.\n")); return; }

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
  console.log(box(["프로바이더 관리"]));
  console.log();

  if (providers.length > 0) {
    for (const p of providers) {
      const mark = p.id === defaultP?.id ? chalk.green("● ") : chalk.gray("  ");
      console.log(`    ${mark}${chalk.bold(p.name)} ${chalk.gray(`${p.type} · ${p.model}`)}`);
    }
    console.log();
  } else {
    console.log(chalk.gray("    없음\n"));
  }

  const opts = ["새로 추가"];
  if (providers.length > 1) opts.push("기본 변경");
  if (providers.length > 0) opts.push("삭제");
  opts.push("돌아가기");

  opts.forEach((o, i) => console.log(`    ${chalk.cyan(`${i + 1}.`)} ${o}`));
  console.log();

  const c = await ask(chalk.cyan("  ❯ "));
  const ci = parseInt(c);

  if (ci === 1) {
    await guidedProviderSetup();
  } else if (opts[ci - 1] === "기본 변경") {
    console.log();
    providers.forEach((p, i) => console.log(`    ${chalk.cyan(`${i + 1}.`)} ${p.name} (${p.model})`));
    console.log();
    const pi = parseInt(await ask(chalk.cyan("  ❯ "))) - 1;
    if (pi >= 0 && pi < providers.length) {
      const { setDefaultProvider } = await import("../config/store.js");
      setDefaultProvider(providers[pi].id);
      console.log(chalk.green(`  ✓ 기본: ${providers[pi].name}\n`));
    }
  } else if (opts[ci - 1] === "삭제") {
    console.log();
    providers.forEach((p, i) => console.log(`    ${chalk.cyan(`${i + 1}.`)} ${p.name} (${p.model})`));
    console.log();
    const di = parseInt(await ask(chalk.white("  삭제 번호: "))) - 1;
    if (di >= 0 && di < providers.length) {
      const { removeProvider } = await import("../config/store.js");
      removeProvider(providers[di].id);
      console.log(chalk.green(`  ✓ 삭제: ${providers[di].name}\n`));
    }
  }
}

async function environmentMenu(): Promise<void> {
  const envs = getEnvironments();
  const active = getActiveEnvironment();

  console.log();
  console.log(box(["환경 관리 — XGEN 서버 프로필"]));
  console.log();

  if (envs.length > 0) {
    for (const e of envs) {
      const mark = e.id === active?.id ? chalk.green("● ") : chalk.gray("  ");
      console.log(`    ${mark}${chalk.bold(e.name)} ${chalk.gray(e.url)}`);
      if (e.description) console.log(`      ${chalk.gray(e.description)}`);
    }
    console.log();
  } else {
    console.log(chalk.gray("    등록된 환경 없음\n"));
  }

  const opts = ["새 환경 추가", "기본 프리셋 등록 (본사/제주/롯데몰)"];
  if (envs.length > 0) opts.push("환경 전환 + 로그인");
  if (envs.length > 0) opts.push("삭제");
  opts.push("돌아가기");

  opts.forEach((o, i) => console.log(`    ${chalk.cyan(`${i + 1}.`)} ${o}`));
  console.log();

  const c = await ask(chalk.cyan("  ❯ "));
  const ci = parseInt(c);

  if (ci === 1) {
    const name = await ask(chalk.white("  이름: "));
    const url = await ask(chalk.white("  URL: "));
    const email = await ask(chalk.white("  이메일 (선택): "));
    const desc = await ask(chalk.white("  설명 (선택): "));
    if (name && url) {
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      addEnvironment({ id, name, url: url.replace(/\/+$/, ""), email: email || undefined, description: desc || undefined });
      console.log(chalk.green(`\n  ✓ ${name} 추가됨\n`));
    }
  } else if (ci === 2) {
    const presets: XgenEnvironment[] = [
      { id: "hq", name: "본사 (244)", url: "https://xgen.x2bee.com", email: "admin@plateer.com", description: "본사 배포 환경" },
      { id: "jeju", name: "제주 (243)", url: "https://jeju-xgen.x2bee.com", email: "admin@plateer.com", description: "제주 서버" },
      { id: "lotte", name: "롯데몰 (DGX)", url: "https://lotteimall-xgen.x2bee.com", description: "롯데몰 DGX Spark" },
    ];

    console.log(chalk.bold("\n  기본 환경 프리셋:\n"));
    presets.forEach((p, i) => {
      console.log(`    ${chalk.cyan(`${i + 1}.`)} ${p.name} ${chalk.gray(p.url)}`);
    });
    console.log(`    ${chalk.cyan(`${presets.length + 1}.`)} 전부 등록`);
    console.log();

    const pc = await ask(chalk.cyan("  ❯ "));
    const pi = parseInt(pc);
    if (pi === presets.length + 1) {
      for (const p of presets) addEnvironment(p);
      console.log(chalk.green(`  ✓ ${presets.length}개 환경 등록됨\n`));
    } else if (pi >= 1 && pi <= presets.length) {
      addEnvironment(presets[pi - 1]);
      console.log(chalk.green(`  ✓ ${presets[pi - 1].name} 등록됨\n`));
    }
  } else if (opts[ci - 1] === "환경 전환 + 로그인") {
    console.log();
    envs.forEach((e, i) => {
      const mark = e.id === active?.id ? chalk.green("● ") : "  ";
      console.log(`    ${mark}${chalk.cyan(`${i + 1}.`)} ${e.name} ${chalk.gray(e.url)}`);
    });
    console.log();
    const ei = parseInt(await ask(chalk.cyan("  ❯ "))) - 1;
    if (ei >= 0 && ei < envs.length) {
      switchEnvironment(envs[ei].id);
      console.log(chalk.green(`\n  ✓ ${envs[ei].name} 전환됨 → ${envs[ei].url}`));
      if (envs[ei].email) {
        const pw = await ask(chalk.white(`  비밀번호 (${envs[ei].email}): `));
        if (pw) {
          try {
            const { apiLogin } = await import("../api/auth.js");
            const { setAuth } = await import("../config/store.js");
            const result = await apiLogin(envs[ei].email!, pw);
            if (result.success && result.access_token) {
              setAuth({ accessToken: result.access_token, refreshToken: result.refresh_token ?? "", userId: result.user_id ?? "", username: result.username ?? "", isAdmin: false, expiresAt: null });
              console.log(chalk.green(`  ✓ 로그인: ${result.username}\n`));
            } else {
              console.log(chalk.red(`  ✗ ${result.message}\n`));
            }
          } catch (err) {
            console.log(chalk.red(`  ✗ ${(err as Error).message}\n`));
          }
        }
      }
      console.log();
    }
  } else if (opts[ci - 1] === "삭제") {
    console.log();
    envs.forEach((e, i) => console.log(`    ${chalk.cyan(`${i + 1}.`)} ${e.name}`));
    console.log();
    const di = parseInt(await ask(chalk.white("  삭제 번호: "))) - 1;
    if (di >= 0 && di < envs.length) {
      removeEnvironment(envs[di].id);
      console.log(chalk.green(`  ✓ 삭제: ${envs[di].name}\n`));
    }
  }
}
