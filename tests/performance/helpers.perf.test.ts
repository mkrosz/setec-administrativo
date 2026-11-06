import { describe, expect, it } from "vitest";

import { sugerirEmail } from "@/lib/email";
import { describeError } from "@/lib/error-capture";
import { compararTurmas, mensagemErro, normalizeUrl, palestrantesDe } from "@/lib/setec";
import {
  normalizarCaminho,
  registrarRequisicao,
  resetMetricasParaTestes,
} from "@/lib/observabilidade";

/**
 * Orçamentos leves de performance (CPU local). Não substituem load test externo;
 * garantem que helpers quentes do painel continuam baratos.
 */
function medir(fn: () => void, vezes: number) {
  const inicio = performance.now();
  for (let i = 0; i < vezes; i++) fn();
  return performance.now() - inicio;
}

describe("performance - helpers quentes", () => {
  it("093 - sugerirEmail em lote fica abaixo de 250ms (2k chamadas)", () => {
    const ms = medir(() => {
      sugerirEmail("aluno@gmqil.com");
      sugerirEmail("ok@gmail.com");
    }, 1000);
    expect(ms).toBeLessThan(250);
  });

  it("094 - normalizeUrl + compararTurmas em lote < 100ms", () => {
    const turmas = ["10º ano", "2º ano", "N/A", "1º ano", "Logística"];
    const ms = medir(() => {
      normalizeUrl("site.com/x");
      [...turmas].sort(compararTurmas);
    }, 2000);
    expect(ms).toBeLessThan(100);
  });

  it("095 - mensagemErro traduz 1k erros em < 150ms", () => {
    const ms = medir(() => {
      mensagemErro({ message: "Invalid login credentials" });
      mensagemErro({ message: "Failed to fetch" });
    }, 500);
    expect(ms).toBeLessThan(150);
  });

  it("096 - describeError com cause em 500x < 100ms", () => {
    const err = new Error("capa", { cause: new Error("raiz") });
    const ms = medir(() => {
      describeError(err);
    }, 500);
    expect(ms).toBeLessThan(100);
  });

  it("097 - palestrantesDe em 2k itens < 80ms", () => {
    const base = {
      palestrantes: [
        { nome: "A", cargo: null, foto_url: null, sobre: null },
        { nome: "B", cargo: "Dev", foto_url: "/b", sobre: null },
      ],
      nome_completo: "",
      cargo: null,
      sobre_palestrante: null,
      foto_url: null as string | null,
    };
    const ms = medir(() => {
      palestrantesDe(base);
    }, 2000);
    expect(ms).toBeLessThan(80);
  });

  it("098 - registrarRequisicao 5k vezes < 400ms", () => {
    resetMetricasParaTestes();
    const ms = medir(() => {
      registrarRequisicao({
        metodo: "GET",
        caminho: normalizarCaminho("/painel"),
        status: 200,
        duracaoMs: 12,
      });
    }, 5000);
    expect(ms).toBeLessThan(400);
    resetMetricasParaTestes();
  });

  it("099 - normalizarCaminho com UUID 3k vezes < 80ms", () => {
    const url = "https://x.test/checkin/550e8400-e29b-41d4-a716-446655440000?q=1";
    const ms = medir(() => {
      normalizarCaminho(url);
    }, 3000);
    expect(ms).toBeLessThan(80);
  });
});
