import { expect, test } from "@playwright/test";

/**
 * Fluxos públicos: não precisam de conta Supabase.
 * Ainda assim dependem do app subir (pnpm dev / E2E_BASE_URL).
 */
test.describe("Páginas públicas", () => {
  test("100 - tela de login carrega com formulário", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByLabel("E-mail")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar no painel" })).toBeVisible();
  });

  test("101 - check-in com token inválido mostra a página (não 5xx)", async ({ page }) => {
    const res = await page.goto("/checkin/token-invalido-e2e");
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });
});
