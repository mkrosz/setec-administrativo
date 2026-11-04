import { expect, test } from "@playwright/test";

import { contaAdmin, entrar, temContaAdmin } from "./apoio";

test.describe("Login com conta do Supabase", () => {
  test.skip(!temContaAdmin, "Defina E2E_EMAIL e E2E_PASSWORD (conta de teste) para rodar.");

  test("079 - login válido abre o painel administrativo", async ({ page }) => {
    await entrar(page, contaAdmin);

    await expect(page.getByRole("button", { name: "Sair do painel" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Palestras/ })).toBeVisible();
    await expect(page.getByText("Adicionar palestra")).toBeVisible();
  });
});
