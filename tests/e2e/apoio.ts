import { expect, type Page } from "@playwright/test";

/**
 * Contas de teste do Supabase, lidas do ambiente (.env local ou secrets do CI).
 * Sem elas, os testes que precisam de login são pulados.
 */
export const contaAdmin = {
  email: process.env["E2E_EMAIL"] ?? "",
  senha: process.env["E2E_PASSWORD"] ?? "",
};

export const contaComum = {
  email: process.env["E2E_COMUM_EMAIL"] ?? "",
  senha: process.env["E2E_COMUM_PASSWORD"] ?? "",
};

export const temContaAdmin = !!contaAdmin.email && !!contaAdmin.senha;
export const temContaComum = !!contaComum.email && !!contaComum.senha;

/**
 * Os testes que criam, editam e apagam registros só rodam com E2E_PERMITIR_ESCRITA=1,
 * para nunca alterarem o banco por engano. Use um projeto Supabase de teste.
 */
export const podeEscrever = process.env["E2E_PERMITIR_ESCRITA"] === "1";

/** Prefixo dos registros criados pelos testes, para achá-los e apagá-los. */
export const PREFIXO = "[E2E]";

export function tituloUnico(nome: string) {
  return `${PREFIXO} ${nome} ${Date.now()}`;
}

/** Faz login pela tela inicial e espera o painel abrir. */
export async function entrar(page: Page, conta: { email: string; senha: string }) {
  await page.goto("/");
  // A página chega pronta do servidor (SSR): espera o React assumir o formulário.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail").fill(conta.email);
  await page.getByLabel("Senha", { exact: true }).fill(conta.senha);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page).toHaveURL(/\/painel/, { timeout: 20_000 });
}
