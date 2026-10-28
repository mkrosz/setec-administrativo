// Valida a estrutura mínima do repositório. Usado pelo CI (npm run validate).
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const obrigatorios = [
  "README.md",
  "CONTRIBUTING.md",
  ".env.example",
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "vite.config.ts",
  "src/router.tsx",
  "src/server.ts",
  "src/routes/__root.tsx",
  "supabase/migrations",
  ".github/pull_request_template.md",
];

const erros = obrigatorios.filter((p) => !existsSync(p)).map((p) => `Arquivo ausente: ${p}`);

// Nenhum arquivo .env real pode estar versionado (só o .env.example).
const versionados = execSync("git ls-files", { encoding: "utf8" }).split("\n");
for (const arquivo of versionados) {
  const nome = arquivo.split("/").pop() ?? "";
  if (/^\.env(\..+)?$/.test(nome) && nome !== ".env.example") {
    erros.push(`Arquivo de ambiente versionado: ${arquivo}`);
  }
}

if (erros.length > 0) {
  console.error("Estrutura inválida:\n" + erros.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

console.log(`Estrutura OK (${obrigatorios.length} itens verificados, nenhum .env versionado).`);
