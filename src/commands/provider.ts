/**
 * xgen provider — AI 프로바이더 관리 (가이드 설정)
 */
import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline";
import OpenAI from "openai";
import {
  addProvider,
  getProviders,
  removeProvider,
  getDefaultProvider,
  setDefaultProvider,
  type ProviderConfig,
} from "../config/store.js";
import { printSuccess, printError, printTable } from "../utils/format.js";

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

interface ProviderPreset {
  label: string;
  type: ProviderConfig["type"];
  baseUrl?: string;
  defaultModel: string;
  models: string[];
  needsKey: boolean;
  keyHint: string;
}

const PRESETS: ProviderPreset[] = [
  {
    label: "OpenAI",
    type: "openai",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3-mini"],
    needsKey: true,
    keyHint: "https://platform.openai.com/api-keys 에서 발급",
  },
  {
    label: "Google Gemini",
    type: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.5-pro-preview-06-05", "gemini-2.5-flash-preview-05-20"],
    needsKey: true,
    keyHint: "https://aistudio.google.com/apikey 에서 발급",
  },
  {
    label: "Ollama (로컬)",
    type: "ollama",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
    models: ["llama3.1", "llama3.2", "codellama", "mistral", "qwen2.5-coder"],
    needsKey: false,
    keyHint: "https://ollama.ai 에서 설치",
  },
  {
    label: "Anthropic (Claude)",
    type: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-4-5-20251001"],
    needsKey: true,
    keyHint: "https://console.anthropic.com/settings/keys 에서 발급",
  },
  {
    label: "Custom (OpenAI 호환 서버)",
    type: "custom",
    defaultModel: "gpt-4o-mini",
    models: [],
    needsKey: true,
    keyHint: "서버에서 발급받은 API Key",
  },
];

/**
 * 가이드 설정 — 에이전트에서 프로바이더 없을 때 자동 호출됨
 */
export async function guidedProviderSetup(): Promise<ProviderConfig | null> {
  console.log(chalk.cyan.bold("\n  ⚡ OPEN XGEN — 프로바이더 설정\n"));
  console.log(chalk.gray("  AI 에이전트를 사용하려면 프로바이더를 설정하세요.\n"));

  // 1. 프로바이더 선택
  console.log(chalk.bold("  프로바이더 선택:\n"));
  PRESETS.forEach((p, i) => {
    console.log(`    ${chalk.cyan(`${i + 1})`)} ${p.label} ${chalk.gray(`— ${p.defaultModel}`)}`);
  });
  console.log();

  const choice = await prompt(chalk.white("  번호 선택: "));
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= PRESETS.length) {
    printError("잘못된 선택입니다.");
    return null;
  }

  const preset = PRESETS[idx];
  console.log(chalk.green(`\n  ✓ ${preset.label} 선택됨\n`));

  // 2. API Key
  let apiKey = "";
  if (preset.needsKey) {
    console.log(chalk.gray(`  ${preset.keyHint}\n`));
    apiKey = await prompt(chalk.white("  API Key: "));
    if (!apiKey) {
      printError("API Key가 필요합니다.");
      return null;
    }
  }

  // 3. Base URL (custom / ollama)
  let baseUrl = preset.baseUrl;
  if (preset.type === "custom") {
    const url = await prompt(chalk.white("  Base URL: "));
    if (!url) {
      printError("Base URL이 필요합니다.");
      return null;
    }
    baseUrl = url;
  } else if (preset.type === "ollama") {
    const url = await prompt(chalk.white(`  Base URL [${preset.baseUrl}]: `));
    if (url) baseUrl = url;
  }

  // 4. 모델 선택
  let model = preset.defaultModel;
  if (preset.models.length > 0) {
    console.log(chalk.bold("\n  모델 선택:\n"));
    preset.models.forEach((m, i) => {
      const isDefault = m === preset.defaultModel ? chalk.gray(" (기본)") : "";
      console.log(`    ${chalk.cyan(`${i + 1})`)} ${m}${isDefault}`);
    });
    console.log(`    ${chalk.cyan(`${preset.models.length + 1})`)} 직접 입력`);
    console.log();

    const defaultIdx = preset.models.indexOf(preset.defaultModel);
    const mc = await prompt(chalk.white(`  번호 선택 [${defaultIdx + 1}]: `));
    if (!mc) {
      // 엔터 → 기본 모델
      model = preset.defaultModel;
    } else {
      const mi = parseInt(mc) - 1;
      if (!isNaN(mi) && mi >= 0 && mi < preset.models.length) {
        model = preset.models[mi];
      } else if (parseInt(mc) === preset.models.length + 1) {
        model = (await prompt(chalk.white("  모델 이름: "))) || preset.defaultModel;
      } else {
        model = preset.defaultModel;
      }
    }
  } else {
    model = (await prompt(chalk.white(`  모델 이름 [${preset.defaultModel}]: `))) || preset.defaultModel;
  }

  console.log(chalk.green(`\n  ✓ 모델: ${model}`));

  // 5. 연결 테스트
  console.log(chalk.gray("\n  연결 테스트 중..."));
  const provider: ProviderConfig = {
    id: preset.type,
    name: preset.label,
    type: preset.type,
    baseUrl,
    apiKey,
    model,
  };

  try {
    const client = new OpenAI({
      apiKey: apiKey || "ollama",
      baseURL: baseUrl,
    });
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 5,
    });
    if (res.choices[0]) {
      console.log(chalk.green("  ✓ 연결 성공!\n"));
    }
  } catch (err) {
    console.log(chalk.yellow(`  ⚠ 연결 테스트 실패: ${(err as Error).message}`));
    console.log(chalk.gray("  설정은 저장됩니다. 나중에 다시 시도하세요.\n"));
  }

  // 6. 저장
  addProvider(provider);
  console.log(chalk.green.bold(`  ✓ ${preset.label} (${model}) 설정 완료!\n`));
  console.log(chalk.gray(`  이제 ${chalk.cyan("xgen agent")} 또는 ${chalk.cyan("xgen")} 으로 시작하세요.\n`));

  return provider;
}

export function registerProviderCommand(program: Command): void {
  const prov = program.command("provider").description("AI 프로바이더 관리");

  prov
    .command("add")
    .description("프로바이더 추가 (가이드 설정)")
    .action(async () => {
      await guidedProviderSetup();
    });

  prov
    .command("list")
    .alias("ls")
    .description("프로바이더 목록")
    .action(() => {
      const providers = getProviders();
      const defaultP = getDefaultProvider();

      if (providers.length === 0) {
        console.log(chalk.yellow("\n  프로바이더가 없습니다."));
        console.log(`  ${chalk.cyan("xgen provider add")} 로 추가하세요.\n`);
        return;
      }

      console.log(chalk.cyan.bold(`\n  프로바이더 (${providers.length}개)\n`));
      printTable(
        ["", "ID", "이름", "타입", "모델"],
        providers.map((p) => [
          p.id === defaultP?.id ? chalk.green("●") : " ",
          p.id,
          p.name,
          p.type,
          p.model,
        ])
      );
      console.log();
    });

  prov
    .command("remove <id>")
    .description("프로바이더 제거")
    .action((id: string) => {
      if (removeProvider(id)) {
        printSuccess(`프로바이더 제거: ${id}`);
      } else {
        printError(`프로바이더를 찾을 수 없습니다: ${id}`);
      }
    });

  prov
    .command("use <id>")
    .description("기본 프로바이더 설정")
    .action((id: string) => {
      if (setDefaultProvider(id)) {
        printSuccess(`기본 프로바이더: ${id}`);
      } else {
        printError(`프로바이더를 찾을 수 없습니다: ${id}`);
      }
    });
}
