import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  // shebang은 bin/xgen에서 처리
});
