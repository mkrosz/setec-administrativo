import { describe, expect, it } from "vitest";

import type { Presenca } from "@/lib/setec";
import {
  CORES_ROLETA,
  corDoGomo,
  gomoNaSeta,
  nomeCurto,
  novoParticipanteManual,
  participanteManual,
  participantesDaChamada,
  rotacaoFinal,
  sortearIndice,
} from "@/lib/sorteio";

function presenca(id: string, nome: string, ra: string, turma = "4º ano"): Presenca {
  return {
    id,
    palestra_id: "p1",
    qrcode_id: null,
    nome_completo: nome,
    ra,
    ano_turma: turma,
    origem: "qrcode",
    latitude: null,
    longitude: null,
    precisao_m: null,
    localizacao: null,
    registrado_em: "2026-11-11T10:00:00Z",
    created_at: "2026-11-11T10:00:00Z",
  };
}

describe("sorteio - participantes", () => {
  it("127 - monta a roleta com a chamada em ordem alfabética e a turma", () => {
    const lista = participantesDaChamada([
      presenca("1", "Pedro Alves", "111"),
      presenca("2", "  Ana Souza ", "222", "Logística"),
    ]);
    expect(lista.map((p) => p.nome)).toEqual(["Ana Souza", "Pedro Alves"]);
    expect(lista[0]).toMatchObject({ id: "2", detalhe: "Logística", origem: "presenca" });
  });

  it("128 - o mesmo RA aparece uma vez só na roleta", () => {
    const lista = participantesDaChamada([
      presenca("1", "Ana Souza", "222"),
      presenca("2", "Ana Souza", "222"),
      presenca("3", "Bruno Lima", "333"),
    ]);
    expect(lista).toHaveLength(2);
  });

  it("129 - aluno incluído à mão mostra ano e curso e não vira presença", () => {
    const novo = novoParticipanteManual(
      { nome: "  Carla   Dias ", ano: "2º ano", curso: "ADS" },
      "x",
    );
    expect(novo).toEqual({ id: "manual-x", nome: "Carla Dias", ano: "2º ano", curso: "ADS" });
    if (typeof novo === "string") throw new Error(novo);
    expect(participanteManual(novo)).toEqual({
      id: "manual-x",
      nome: "Carla Dias",
      detalhe: "2º ano · ADS",
      origem: "manual",
    });
  });

  it("130 - inclusão à mão exige o nome", () => {
    expect(novoParticipanteManual({ nome: " ", ano: "1º", curso: "" }, "y")).toBe(
      "Informe o nome do aluno.",
    );
  });

  it("131 - nome curto usa primeiro e último nome", () => {
    expect(nomeCurto("Maria Eduarda Santos Lima")).toBe("Maria Lima");
    expect(nomeCurto("João Pedro")).toBe("João Pedro");
  });
});

describe("sorteio - roleta", () => {
  it("132 - a rotação final para o gomo sorteado exatamente na seta", () => {
    for (const total of [1, 2, 7, 20, 53]) {
      let rotacao = 0;
      for (let indice = 0; indice < total; indice += Math.max(1, Math.floor(total / 5))) {
        for (const desvio of [-0.5, 0, 0.49]) {
          rotacao = rotacaoFinal(rotacao, indice, total, 6, desvio);
          expect(gomoNaSeta(rotacao, total)).toBe(indice);
        }
      }
    }
  });

  it("133 - a roleta sempre gira para a frente, com pelo menos as voltas pedidas", () => {
    const final = rotacaoFinal(1000, 3, 10, 6);
    expect(final).toBeGreaterThanOrEqual(1000 + 6 * 360);
    expect(final).toBeLessThan(1000 + 7 * 360);
  });

  it("134 - o índice sorteado fica dentro da lista e falha com a roleta vazia", () => {
    expect(sortearIndice(5, () => 0)).toBe(0);
    expect(sortearIndice(5, () => 0.999999)).toBe(4);
    expect(sortearIndice(3)).toBeLessThan(3);
    expect(() => sortearIndice(0)).toThrow("Não há ninguém na roleta.");
  });

  it("135 - usa as cores da SETEC sem repetir a cor entre o último e o primeiro gomo", () => {
    expect(corDoGomo(0, 10)).toBe(CORES_ROLETA[0]);
    const total = CORES_ROLETA.length + 1;
    expect(corDoGomo(total - 1, total)).not.toBe(corDoGomo(0, total));
  });
});
