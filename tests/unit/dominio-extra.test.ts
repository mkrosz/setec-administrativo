import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";
import {
  CATEGORIAS,
  GRUPOS_COMISSAO,
  LINK_TYPES,
  NIVEIS,
  TURMA_NA,
  formatDia,
  formatHora,
  initials,
  mensagemErro,
  normalizeUrl,
  semestresDoGrupo,
} from "@/lib/setec";
import { sugerirEmail } from "@/lib/email";
import { renderErrorPage } from "@/lib/error-page";
import { normalizarCaminho, statusSaude } from "@/lib/observabilidade";

describe("domínio e utilitários - cobertura extra", () => {
  it("102 - LINK_TYPES cobre redes principais", () => {
    const values = LINK_TYPES.map((l) => l.value);
    expect(values).toEqual(
      expect.arrayContaining(["linkedin", "site", "instagram", "github", "youtube"]),
    );
  });

  it("103 - todos os grupos da comissão têm label", () => {
    for (const g of GRUPOS_COMISSAO) {
      expect(g.label.length).toBeGreaterThan(0);
      expect(semestresDoGrupo(g.value)).toBe(g.semestres);
    }
  });

  it("104 - NIVEIS e CATEGORIAS não têm duplicatas", () => {
    expect(new Set(NIVEIS).size).toBe(NIVEIS.length);
    expect(new Set(CATEGORIAS).size).toBe(CATEGORIAS.length);
  });

  it("105 - TURMA_NA é a sentinela esperada", () => {
    expect(TURMA_NA).toBe("N/A");
  });

  it("106 - formatDia em dezembro e formatHora curta", () => {
    expect(formatDia("2026-12-31")).toBe("31 Dez");
    expect(formatHora("00:00:59")).toBe("00:00");
  });

  it("107 - initials com três nomes usa só os dois primeiros", () => {
    expect(initials("Ana Maria Braga")).toBe("AM");
  });

  it("108 - normalizeUrl é idempotente com https", () => {
    const u = normalizeUrl("https://a.com");
    expect(normalizeUrl(u)).toBe(u);
  });

  it("109 - sugerirEmail em cps tipado errado", () => {
    expect(sugerirEmail("a@cps.sp.gov.be")).toBe("a@cps.sp.gov.br");
  });

  it("110 - mensagemErro com padrão customizado", () => {
    expect(mensagemErro(undefined, "Ops")).toBe("Ops");
  });

  it("111 - renderErrorPage tem botão de reload", () => {
    expect(renderErrorPage()).toContain("location.reload()");
  });

  it("112 - cn com condicionais", () => {
    expect(cn("base", true && "on", false && "off")).toBe("base on");
  });

  it("113 - normalizarCaminho de URL absoluta sem path", () => {
    expect(normalizarCaminho("https://exemplo.com")).toBe("/");
  });

  it("114 - statusSaude.ok implícito via status", () => {
    expect(statusSaude()).toMatchObject({ status: "ok" });
  });
});
