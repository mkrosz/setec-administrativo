import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Configuração própria dos testes: não carrega o vite.config.ts (plugins da Lovable,
// TanStack Start e Nitro), só o alias "@" usado nos imports do projeto.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/integracao/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
    restoreMocks: true,
    unstubEnvs: true,
  },
});
