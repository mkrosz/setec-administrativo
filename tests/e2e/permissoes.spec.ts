import { expect, test } from "@playwright/test";

import { contaComum, entrar, temContaComum } from "./apoio";

test.describe("Permissões por nível de acesso", () => {
  test.skip(
    !temContaComum,
    "Defina E2E_COMUM_EMAIL e E2E_COMUM_PASSWORD (conta de teste com nível Usuário comum).",
  );

  test("089 - usuário comum não vê Presença nem Controle de Acessos", async ({ page }) => {
    await entrar(page, contaComum);

    // Gerencia a programação normalmente...
    await expect(page.getByText("Adicionar palestra")).toBeVisible();

    // ...mas sem as áreas restritas a administradores.
    await expect(page.getByRole("button", { name: "Presença" })).toHaveCount(0);
    await expect(page.getByText("Controle de Acessos")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Resetar dados do ano" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Importar dados" })).toHaveCount(0);
  });
});
