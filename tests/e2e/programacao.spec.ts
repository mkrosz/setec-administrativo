import { expect, test, type Page } from "@playwright/test";

import { contaAdmin, entrar, podeEscrever, temContaAdmin, tituloUnico } from "./apoio";

// Cria, edita e apaga registros: só roda com conta de teste e E2E_PERMITIR_ESCRITA=1.
test.skip(
  !temContaAdmin || !podeEscrever,
  "Defina E2E_EMAIL, E2E_PASSWORD e E2E_PERMITIR_ESCRITA=1 (Supabase de teste) para rodar.",
);

/** Rascunhos ficam numa aba própria da programação, os mais recentes primeiro. */
async function abrirRascunhos(page: Page) {
  await page.getByRole("button", { name: /^Rascunhos/ }).click();
}

function linha(page: Page, titulo: string) {
  return page.getByRole("listitem").filter({ hasText: titulo });
}

async function remover(page: Page, titulo: string, tipo: "palestra" | "minicurso") {
  const item = linha(page, titulo);
  await item.hover();
  await item.getByRole("button", { name: `Remover ${tipo}` }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Remover|Excluir/ })
    .click();
  await expect(linha(page, titulo)).toHaveCount(0);
}

test.describe("Programação - palestras", () => {
  test("086 - criar uma palestra e ver ela na lista", async ({ page }) => {
    const titulo = tituloUnico("Palestra criada");
    await entrar(page, contaAdmin);

    await page.getByText("Adicionar palestra").click();
    await page.getByPlaceholder("O Futuro da IA no Design").fill(titulo);
    await page.getByRole("button", { name: "Salvar como rascunho" }).click();
    await expect(page.getByText("Rascunho salvo")).toBeVisible();

    await abrirRascunhos(page);
    await expect(linha(page, titulo)).toBeVisible();

    await remover(page, titulo, "palestra");
  });
});
