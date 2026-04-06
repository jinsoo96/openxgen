/**
 * xgen provider — AI 프로바이더 관리
 */
import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline";
import {
  addProvider,
  getProviders,
  removeProvider,
  getDefaultProvider,
  setDefaultProvider,
  type ProviderConfig,
} from "../config/store.js";
import { printSuccess, printError, printHeader, printTable } from "../utils/format.js";

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const PROVIDER_PRESETS: Record<string, { baseUrl?: string; defaultModel: string }> = {
  openai: { defaultModel: "gpt-4o-mini" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.0-flash" },
  ollama: { baseUrl: "http://localhost:11434/v1", defaultModel: "llama3.1" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-sonnet-4-20250514" },
  custom: { defaultModel: "gpt-4o-mini" },
};

export function registerProviderCommand(program: Command): void {
  const prov = program.command("provider").description("AI 프로바이더 관리");

  prov
    .command("add")
    .description("프로바이더 추가 (대화형)")
    .action(async () => {
      printHeader("프로바이더 추가");
      console.log();

      const types = Object.keys(PROVIDER_PRESETS);
      console.log(chalk.gray("지원 타입:"), types.join(", "));
      const type = (await prompt(chalk.white("타입: "))) as ProviderConfig["type"];
      if (!types.includes(type)) {
        printError(`지원하지 않는 타입: ${type}`);
        process.exit(1);
      }

      const preset = PROVIDER_PRESETS[type];
      const name = (await prompt(chalk.white("이름 (표시용): "))) || type;
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-");

      let baseUrl = preset.baseUrl;
      if (type === "custom" || type === "ollama") {
        const input = await prompt(chalk.white(`Base URL [${preset.baseUrl ?? ""}]: `));
        if (input) baseUrl = input;
      }

      let apiKey = "";
      if (type !== "ollama") {
        apiKey = await prompt(chalk.white("API Key: "));
        if (!apiKey) {
          printError("API Key가 필요합니다");
          process.exit(1);
        }
      }

      const model = (await prompt(chalk.white(`모델 [${preset.defaultModel}]: `))) || preset.defaultModel;

      const provider: ProviderConfig = { id, name, type, baseUrl, apiKey, model };
      addProvider(provider);

      console.log();
      printSuccess(`프로바이더 추가 완료: ${chalk.bold(name)} (${model})`);
    });

  prov
    .command("list")
    .alias("ls")
    .description("프로바이더 목록")
    .action(() => {
      const providers = getProviders();
      const defaultP = getDefaultProvider();

      if (providers.length === 0) {
        console.log(chalk.yellow("\n프로바이더가 없습니다. xgen provider add 로 추가하세요.\n"));
        return;
      }

      printHeader(`프로바이더 (${providers.length}개)`);
      console.log();
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
