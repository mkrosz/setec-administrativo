import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Configuração própria dos testes: não carrega o vite.config.ts (plugins da Lovable,
// TanStack Start e Nitro), só o alias "@" usado nos imports do projeto.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integracao/**/*.test.ts",
      "tests/performance/**/*.test.ts",
    ],
    environment: "node",
    passWithNoTests: true,
    restoreMocks: true,
    unstubEnvs: true,
    reporters: process.env["CI"] ? ["default", "json", "junit"] : ["default"],
    outputFile: {
      json: "test-results/vitest.json",
      junit: "test-results/vitest-junit.xml",
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "text-summary", "html", "json-summary", "lcov"],
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/access.functions.ts",
        "src/lib/account.functions.ts",
        "src/lib/backup.ts",
        "src/lib/minicurso-pdf.ts",
        "src/lib/presenca-pdf.ts",
        "src/lib/devolucoes.ts",
      ],
    },
  },
});
