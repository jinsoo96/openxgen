/**
 * xgen ontology — 온톨로지 GraphRAG 질의
 */
import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline";
import { requireAuth } from "../config/store.js";
import { queryGraphRAG, queryGraphRAGMultiTurn, getGraphStats } from "../api/ontology.js";
import { printError, printHeader } from "../utils/format.js";
import { randomUUID } from "node:crypto";

export function registerOntologyCommand(program: Command): void {
  const ont = program.command("ontology").alias("ont").description("온톨로지 GraphRAG 질의");

  ont
    .command("query <question>")
    .alias("q")
    .description("GraphRAG 원샷 질의")
    .option("-g, --graph <id>", "그래프 ID")
    .option("--no-scs", "SCS 컨텍스트 비활성화")
    .action(async (question: string, opts) => {
      requireAuth();
      try {
        console.log(chalk.gray("\n질의 중...\n"));
        const result = await queryGraphRAG(question, opts.graph, { scs: opts.scs });

        if (result.answer) {
          console.log(chalk.bold("답변:"));
          console.log(result.answer);
        }
        if (result.sources?.length) {
          console.log(chalk.bold("\n출처:"));
          result.sources.forEach((s) => console.log(chalk.gray(`  - ${s}`)));
        }
        if (result.triples_used?.length) {
          console.log(chalk.bold("\n사용된 트리플:"));
          result.triples_used.forEach((t) => console.log(chalk.dim(`  ${t}`)));
        }
        console.log();
      } catch (err) {
        printError(`질의 실패: ${(err as Error).message}`);
      }
    });

  ont
    .command("chat")
    .description("멀티턴 GraphRAG 대화")
    .option("-g, --graph <id>", "그래프 ID")
    .action(async (opts) => {
      requireAuth();
      const sessionId = randomUUID();

      printHeader("Ontology Chat");
      console.log(chalk.gray("멀티턴 GraphRAG 대화. exit로 종료.\n"));

      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const ask = (): Promise<string> =>
        new Promise((resolve) => rl.question(chalk.green("❯ "), (a) => resolve(a.trim())));

      while (true) {
        const input = await ask();
        if (!input) continue;
        if (input === "exit") {
          rl.close();
          break;
        }

        try {
          const result = await queryGraphRAGMultiTurn(input, sessionId, opts.graph);
          if (result.answer) console.log(`\n${result.answer}\n`);
        } catch (err) {
          console.log(chalk.red(`오류: ${(err as Error).message}\n`));
        }
      }
    });

  ont
    .command("stats <graph-id>")
    .description("그래프 통계")
    .action(async (graphId: string) => {
      requireAuth();
      try {
        const stats = await getGraphStats(graphId);
        printHeader("그래프 통계");
        console.log(chalk.gray(JSON.stringify(stats, null, 2)));
        console.log();
      } catch (err) {
        printError(`통계 조회 실패: ${(err as Error).message}`);
      }
    });
}
