import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  logErro,
  logEvento,
  normalizarCaminho,
  podeVerErros,
  registrarRequisicao,
  resetMetricasParaTestes,
  snapshotMetricas,
  statusSaude,
} from "@/lib/observabilidade";

beforeEach(() => {
  resetMetricasParaTestes();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetMetricasParaTestes();
});

describe("normalizarCaminho", () => {
  it("055 - remove query string e mantém pathname", () => {
    expect(normalizarCaminho("https://app.test/painel?x=1")).toBe("/painel");
    expect(normalizarCaminho("/presenca")).toBe("/presenca");
  });

  it("056 - substitui UUID por :id", () => {
    expect(normalizarCaminho("/checkin/550e8400-e29b-41d4-a716-446655440000")).toBe("/checkin/:id");
  });
});

describe("logs estruturados", () => {
  it("058 - logEvento info escreve JSON no console.info", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const ev = logEvento("info", "teste", "olá", { a: 1 });
    expect(ev.nivel).toBe("info");
    expect(ev.tipo).toBe("teste");
    expect(spy).toHaveBeenCalled();
    const linha = String(spy.mock.calls[0]?.[0]);
    expect(JSON.parse(linha).mensagem).toBe("olá");
  });

  it("059 - logErro registra Error e guarda em ultimos_erros", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logErro("falha.x", new Error("quebrou"), { rota: "/x" });
    expect(spy).toHaveBeenCalled();
    expect(snapshotMetricas({ incluirErros: true }).ultimos_erros?.at(-1)?.mensagem).toBe(
      "quebrou",
    );
  });

  it("060 - logErro aceita string e valor genérico", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(logErro("s", "msg").mensagem).toBe("msg");
    expect(logErro("s", { x: 1 }).mensagem).toBe("erro desconhecido");
  });
});

describe("métricas de requisição", () => {
  it("061 - agrega contagem, média e erros 5xx", () => {
    registrarRequisicao({ metodo: "GET", caminho: "/painel", status: 200, duracaoMs: 40 });
    registrarRequisicao({ metodo: "GET", caminho: "/painel", status: 500, duracaoMs: 60 });
    registrarRequisicao({ metodo: "POST", caminho: "/api", status: 201, duracaoMs: 20 });

    const s = snapshotMetricas();
    expect(s.ok).toBe(true);
    expect(s.requisicoes).toBe(3);
    expect(s.erros).toBe(1);
    expect(s.taxa_erro).toBeCloseTo(1 / 3, 4);
    expect(s.duracao_media_ms).toBe(40);
    const painel = s.rotas.find((r) => r.rota === "GET /painel");
    expect(painel?.requisicoes).toBe(2);
    expect(painel?.erros).toBe(1);
    expect(painel?.duracao_max_ms).toBe(60);
  });

  it("062 - statusSaude reporta ok e uptime", () => {
    const saude = statusSaude();
    expect(saude.status).toBe("ok");
    expect(saude.uptime_s).toBeGreaterThanOrEqual(0);
    expect(saude.ts).toMatch(/^\d{4}-/);
  });

  it("063 - reset zera snapshot", () => {
    registrarRequisicao({ metodo: "GET", caminho: "/", status: 200, duracaoMs: 1 });
    resetMetricasParaTestes();
    expect(snapshotMetricas().requisicoes).toBe(0);
    expect(snapshotMetricas().rotas).toEqual([]);
  });
});

describe("proteção dos detalhes de erro no /metrics", () => {
  it("125 - snapshot público não inclui as mensagens de erro", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    logErro("falha.interna", new Error("senha do banco errada"));

    const publico = snapshotMetricas();
    expect(publico).not.toHaveProperty("ultimos_erros");
    expect(JSON.stringify(publico)).not.toContain("senha do banco");
  });

  it("126 - só libera os erros com o token certo no cabeçalho Authorization", () => {
    const comToken = (valor?: string) =>
      new Request("http://localhost/metrics", {
        headers: valor ? { authorization: valor } : {},
      });

    expect(podeVerErros(comToken("Bearer segredo"), "segredo")).toBe(true);
    expect(podeVerErros(comToken("Bearer errado"), "segredo")).toBe(false);
    expect(podeVerErros(comToken(), "segredo")).toBe(false);
    // Sem METRICS_TOKEN configurado, ninguém vê os erros.
    expect(podeVerErros(comToken("Bearer "), "")).toBe(false);
    expect(podeVerErros(comToken("Bearer undefined"), undefined)).toBe(false);
  });
});
