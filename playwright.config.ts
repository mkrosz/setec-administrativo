import { defineConfig, devices } from "@playwright/test";

// E2E: por padrão sobe o servidor de desenvolvimento (porta 8080).
// Para testar outro ambiente (Docker, preview da Vercel), defina E2E_BASE_URL.
const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:8080";

export default defineConfig({
  testDir: "tests/e2e",
  // Os testes logam com a mesma conta e mexem nos mesmos dados: um de cada vez.
  fullyParallel: false,
  workers: 1,
  retries: process.env["CI"] ? 1 : 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(process.env["E2E_BASE_URL"]
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
