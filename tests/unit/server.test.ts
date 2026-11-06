import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  normalizarCaminho,
  registrarRequisicao,
  resetMetricasParaTestes,
  snapshotMetricas,
  statusSaude,
} from "@/lib/observabilidade";

describe("server.ts - observabilidade integrada", () => {
  beforeEach(() => {
    resetMetricasParaTestes();
  });

  it("118 - statusSaude sempre retorna ok com timestamp ISO", () => {
    const saude = statusSaude();
    expect(saude.status).toBe("ok");
    expect(saude.uptime_s).toBeGreaterThanOrEqual(0);
    expect(saude.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("119 - snapshotMetricas com requisições de sucesso e erro", () => {
    registrarRequisicao({ metodo: "GET", caminho: "/painel", status: 200, duracaoMs: 50 });
    registrarRequisicao({ metodo: "POST", caminho: "/api", status: 500, duracaoMs: 100 });

    const s = snapshotMetricas();
    expect(s.ok).toBe(true);
    expect(s.requisicoes).toBe(2);
    expect(s.erros).toBe(1);
    expect(s.taxa_erro).toBeCloseTo(0.5, 4);
    expect(s.duracao_media_ms).toBe(75);
  });

  it("120 - snapshotMetricas rotas ordenadas por contagem", () => {
    registrarRequisicao({ metodo: "GET", caminho: "/painel", status: 200, duracaoMs: 10 });
    registrarRequisicao({ metodo: "GET", caminho: "/painel", status: 200, duracaoMs: 20 });
    registrarRequisicao({ metodo: "GET", caminho: "/api", status: 200, duracaoMs: 30 });

    const s = snapshotMetricas();
    expect(s.rotas[0]?.rota).toBe("GET /painel");
    expect(s.rotas[0]?.requisicoes).toBe(2);
    expect(s.rotas[1]?.rota).toBe("GET /api");
    expect(s.rotas[1]?.requisicoes).toBe(1);
  });

  it("121 - normalizarCaminho com UUID múltiplos", () => {
    const url = "https://app.test/palestras/550e8400-e29b-41d4-a716-446655440000/edit";
    expect(normalizarCaminho(url)).toBe("/palestras/:id/edit");
  });

  it("122 - normalizarCaminho sem pathname usa /", () => {
    expect(normalizarCaminho("https://exemplo.com")).toBe("/");
  });

  it("123 - normalizarCaminho com query string complexa", () => {
    const url = "https://app.test/api/data?filter=x&sort=desc&page=2";
    expect(normalizarCaminho(url)).toBe("/api/data");
  });

  it("124 - normalizarCaminho com caminho muito longo limita a 120 chars", () => {
    const longo = "/a".repeat(200);
    const normalizado = normalizarCaminho(`https://app.test${longo}`);
    expect(normalizado.length).toBeLessThanOrEqual(120);
    expect(normalizado).toMatch(/^\/a+\.\.\.$/);
  });
});
