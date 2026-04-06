/**
 * xgen doc — 문서 관리
 */
import { Command } from "commander";
import chalk from "chalk";
import { requireAuth } from "../config/store.js";
import { listDocuments, uploadDocument, getDocumentInfo } from "../api/document.js";
import { printTable, printError, printHeader, formatDate } from "../utils/format.js";

export function registerDocCommand(program: Command): void {
  const doc = program.command("doc").description("문서 관리");

  doc
    .command("list")
    .alias("ls")
    .description("문서 목록 조회")
    .option("-c, --collection <id>", "컬렉션 ID")
    .action(async (opts) => {
      requireAuth();
      try {
        const docs = await listDocuments(opts.collection);
        if (!docs.length) {
          console.log(chalk.yellow("\n문서가 없습니다.\n"));
          return;
        }
        printHeader(`문서 목록 (${docs.length}개)`);
        console.log();
        printTable(
          ["#", "ID", "파일명", "타입", "상태", "생성일"],
          docs.map((d, i) => [
            String(i + 1),
            (d.document_id ?? d.id ?? "-").toString().slice(0, 10),
            d.file_name ?? d.name ?? "-",
            d.file_type ?? "-",
            d.status ?? "-",
            formatDate(d.created_at),
          ])
        );
        console.log();
      } catch (err) {
        printError(`문서 목록 조회 실패: ${(err as Error).message}`);
      }
    });

  doc
    .command("upload <file>")
    .description("문서 업로드")
    .option("-c, --collection <id>", "컬렉션 ID")
    .option("-n, --name <name>", "파일명")
    .action(async (file: string, opts) => {
      requireAuth();
      try {
        console.log(chalk.gray(`업로드 중: ${file}`));
        const result = await uploadDocument(file, opts.collection, opts.name);
        console.log(chalk.green("✓ 업로드 완료"));
        console.log(chalk.gray(JSON.stringify(result, null, 2)));
      } catch (err) {
        printError(`업로드 실패: ${(err as Error).message}`);
      }
    });

  doc
    .command("info <id>")
    .description("문서 상세 정보")
    .action(async (id: string) => {
      requireAuth();
      try {
        const d = await getDocumentInfo(id);
        printHeader("문서 정보");
        console.log(chalk.gray(JSON.stringify(d, null, 2)));
      } catch (err) {
        printError(`조회 실패: ${(err as Error).message}`);
      }
    });
}
