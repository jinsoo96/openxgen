/**
 * xgen provider — AI 프로바이더 관리
 */
import { Command } from "commander";
import chalk from "chalk";
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
import { ask, box } from "../utils/ui.js";

interface ProviderPreset {
  label: string;
  type: ProviderConfig["type"];
  baseUrl?: string;
  defaultModel: string;
  models: string[];
  needsKey: boolean;
  keyHint: string;
  envKey?: string;
}

const PRESETS: ProviderPreset[] = [
  {
    label: "OpenAI",
    type: "openai",
    defaultModel: "gpt-4o-mini",
    models: [
      "gpt-4o", "gpt-4o-mini",
      "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
      "o3-mini", "o4-mini",
      "gpt-3.5-turbo",
    ],
    needsKey: true,
    keyHint: "https://platform.openai.com/api-keys",
    envKey: "OPENAI_API_KEY",
  },
  {
    label: "Google Gemini",
    type: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    models: [
      "gemini-2.5-pro-preview-06-05",
      "gemini-2.5-flash-preview-05-20",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
    ],
    needsKey: true,
    keyHint: "https://aistudio.google.com/apikey",
    envKey: "GEMINI_API_KEY",
  },
  {
    label: "Anthropic (Claude)",
    type: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    models: [
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514",
      "claude-haiku-4-5-20251001",
      "claude-3.5-sonnet-20241022",
    ],
    needsKey: true,
    keyHint: "https://console.anthropic.com/settings/keys",
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    label: "Ollama (로컬 무료)",
    type: "ollama",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
    models: [
      "llama3.1", "llama3.2", "llama3.3",
      "codellama", "deepseek-coder-v2",
      "qwen2.5-coder", "qwen2.5",
      "mistral", "mixtral",
      "phi3", "gemma2",
    ],
    needsKey: false,
    keyHint: "https://ollama.ai 설치 후 ollama pull <모델>",
  },
  {
    label: "Groq (빠른 추론)",
    type: "custom",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
    ],
    needsKey: true,
    keyHint: "https://console.groq.com/keys",
    envKey: "GROQ_API_KEY",
  },
  {
    label: "Together AI",
    type: "custom",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    models: [
      "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
    ],
    needsKey: true,
    keyHint: "https://api.together.xyz/settings/api-keys",
    envKey: "TOGETHER_API_KEY",
  },
  {
    label: "OpenRouter (멀티 모델)",
    type: "custom",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    models: [
      "openai/gpt-4o", "openai/gpt-4o-mini",
      "anthropic/claude-sonnet-4", "anthropic/claude-haiku-4.5",
      "google/gemini-2.0-flash-exp",
      "meta-llama/llama-3.3-70b-instruct",
      "deepseek/deepseek-chat-v3",
    ],
    needsKey: true,
    keyHint: "https://openrouter.ai/keys",
    envKey: "OPENROUTER_API_KEY",
  },
  {
    label: "DeepSeek",
    type: "custom",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: [
      "deepseek-chat",
      "deepseek-coder",
      "deepseek-reasoner",
    ],
    needsKey: true,
    keyHint: "https://platform.deepseek.com/api_keys",
    envKey: "DEEPSEEK_API_KEY",
  },
  {
    label: "기타 (OpenAI 호환 서버)",
    type: "custom",
    defaultModel: "gpt-4o-mini",
    models: [],
    needsKey: true,
    keyHint: "서버에서 발급받은 API Key",
  },
];

/**
 * 환경변수에서 API 키 자동 감지
 */
function detectEnvKey(preset: ProviderPreset): string | null {
  if (!preset.envKey) return null;
  return process.env[preset.envKey] ?? null;
}

/**
 * 가이드 설정
 */
export async function guidedProviderSetup(): Promise<ProviderConfig | null> {
  console.log();
  console.log(box(["OPEN XGEN — 프로바이더 설정", "", chalk.gray("AI 에이전트에 사용할 LLM을 선택하세요.")]));
  console.log();

  // 프로바이더 목록
  console.log(chalk.bold("  프로바이더 선택:\n"));
  PRESETS.forEach((p, i) => {
    const envDetected = detectEnvKey(p);
    const envTag = envDetected ? chalk.green(" [키 감지됨]") : "";
    const free = !p.needsKey ? chalk.green(" [무료]") : "";
    console.log(`    ${chalk.cyan(`${String(i + 1).padStart(2)}.`)} ${p.label}${free}${envTag}`);
    console.log(`        ${chalk.gray(p.defaultModel)}`);
  });
  console.log();

  const choice = await ask(chalk.cyan("  번호: "));
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= PRESETS.length) {
    console.log(chalk.red("  잘못된 선택.\n"));
    return null;
  }

  const preset = PRESETS[idx];
  console.log(chalk.green(`\n  ✓ ${preset.label}\n`));

  // API Key (환경변수 자동감지)
  let apiKey = "";
  if (preset.needsKey) {
    const envKey = detectEnvKey(preset);
    if (envKey) {
      console.log(chalk.green(`  API Key 자동 감지 (${preset.envKey})`));
      const useEnv = await ask(chalk.white(`  이 키를 사용할까요? (Y/n): `));
      if (useEnv.toLowerCase() !== "n") {
        apiKey = envKey;
      }
    }
    if (!apiKey) {
      console.log(chalk.gray(`  발급: ${preset.keyHint}\n`));
      apiKey = await ask(chalk.white("  API Key: "));
      if (!apiKey) {
        console.log(chalk.red("  API Key 필요.\n"));
        return null;
      }
    }
  }

  // Base URL
  let baseUrl = preset.baseUrl;
  if (preset.label === "기타 (OpenAI 호환 서버)") {
    baseUrl = await ask(chalk.white("  Base URL: "));
    if (!baseUrl) {
      console.log(chalk.red("  URL 필요.\n"));
      return null;
    }
  }

  // 모델 선택
  let model = preset.defaultModel;
  if (preset.models.length > 0) {
    console.log(chalk.bold("\n  모델:\n"));
    const defaultIdx = preset.models.indexOf(preset.defaultModel);
    preset.models.forEach((m, i) => {
      const tag = i === defaultIdx ? chalk.green(" ← 추천") : "";
      console.log(`    ${chalk.cyan(`${String(i + 1).padStart(2)}.`)} ${m}${tag}`);
    });
    console.log(`    ${chalk.cyan(`${String(preset.models.length + 1).padStart(2)}.`)} 직접 입력`);
    console.log();

    const mc = await ask(chalk.cyan(`  번호 [${defaultIdx + 1}]: `));
    if (!mc || mc === String(defaultIdx + 1)) {
      model = preset.defaultModel;
    } else {
      const mi = parseInt(mc) - 1;
      if (mi >= 0 && mi < preset.models.length) {
        model = preset.models[mi];
      } else if (parseInt(mc) === preset.models.length + 1) {
        model = (await ask(chalk.white("  모델명: "))) || preset.defaultModel;
      }
    }
  } else if (preset.label === "기타 (OpenAI 호환 서버)") {
    model = (await ask(chalk.white(`  모델명 [${preset.defaultModel}]: `))) || preset.defaultModel;
  }

  console.log(chalk.green(`\n  ✓ ${preset.label} · ${model}`));

  // 연결 테스트
  console.log(chalk.gray("  연결 테스트 중...\n"));
  const provider: ProviderConfig = {
    id: preset.label.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"),
    name: preset.label,
    type: preset.type,
    baseUrl,
    apiKey,
    model,
  };

  try {
    const client = new OpenAI({ apiKey: apiKey || "ollama", baseURL: baseUrl });
    await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 5,
    });
    console.log(chalk.green("  ✓ 연결 성공!\n"));
  } catch (err) {
    const msg = (err as Error).message || "";
    if (msg.includes("401") || msg.includes("API key") || msg.includes("Unauthorized")) {
      console.log(chalk.red(`  ✗ API 키가 유효하지 않습니다.`));
      const retry = await ask(chalk.white("  다시 입력할까요? (Y/n): "));
      if (retry.toLowerCase() !== "n") {
        const newKey = await ask(chalk.white("  API Key: "));
        if (newKey) {
          provider.apiKey = newKey;
          try {
            const c2 = new OpenAI({ apiKey: newKey, baseURL: baseUrl });
            await c2.chat.completions.create({ model, messages: [{ role: "user", content: "Hi" }], max_tokens: 5 });
            console.log(chalk.green("  ✓ 연결 성공!\n"));
          } catch {
            console.log(chalk.yellow("  ⚠ 여전히 실패. 설정은 저장됩니다.\n"));
          }
        }
      } else {
        console.log(chalk.gray("  설정은 저장됩니다.\n"));
      }
    } else if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      console.log(chalk.yellow(`  ⚠ 서버에 연결할 수 없습니다. URL을 확인하세요.`));
      console.log(chalk.gray("  설정은 저장됩니다.\n"));
    } else {
      console.log(chalk.yellow(`  ⚠ 테스트 실패: ${msg}`));
      console.log(chalk.gray("  설정은 저장됩니다.\n"));
    }
  }

  addProvider(provider);
  console.log(chalk.green.bold(`  ✓ 설정 완료! ${preset.label} (${model})\n`));

  return provider;
}

export function registerProviderCommand(program: Command): void {
  const prov = program.command("provider").description("AI 프로바이더 관리");

  prov.command("add").description("프로바이더 추가").action(async () => {
    await guidedProviderSetup();
  });

  prov.command("list").alias("ls").description("프로바이더 목록").action(() => {
    const providers = getProviders();
    const defaultP = getDefaultProvider();
    if (providers.length === 0) {
      console.log(chalk.yellow("\n  프로바이더 없음. xgen provider add\n"));
      return;
    }
    console.log(chalk.cyan.bold(`\n  프로바이더 (${providers.length}개)\n`));
    printTable(
      ["", "ID", "이름", "타입", "모델"],
      providers.map((p) => [
        p.id === defaultP?.id ? chalk.green("●") : " ",
        p.id, p.name, p.type, p.model,
      ])
    );
    console.log();
  });

  prov.command("remove <id>").description("프로바이더 제거").action((id: string) => {
    removeProvider(id) ? printSuccess(`제거: ${id}`) : printError(`없음: ${id}`);
  });

  prov.command("use <id>").description("기본 프로바이더 설정").action((id: string) => {
    setDefaultProvider(id) ? printSuccess(`기본: ${id}`) : printError(`없음: ${id}`);
  });
}
