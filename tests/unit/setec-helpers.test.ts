import { describe, expect, it } from "vitest";

import {
  CATEGORIAS,
  GRUPOS_COMISSAO,
  NIVEIS,
  TURMA_NA,
  compararTurmas,
  coordenadasPresenca,
  formatDataHora,
  formatDia,
  formatHora,
  formatLocalPresenca,
  initials,
  mapsUrl,
  mensagemErro,
  nomesPalestrantes,
  normalizeUrl,
  palestrantesDe,
  porSemestre,
  semestresDoGrupo,
  type MembroComissao,
  type Presenca,
} from "@/lib/setec";

function presenca(parcial: Partial<Presenca> = {}): Presenca {
  return {
    id: "1",
    palestra_id: "p",
    qrcode_id: null,
    nome_completo: "Aluno",
    ra: "123",
    ano_turma: "4º ano",
    origem: "manual",
    latitude: null,
    longitude: null,
    precisao_m: null,
    localizacao: null,
    registrado_em: "2026-11-04T10:00:00Z",
    created_at: "2026-11-04T10:00:00Z",
    ...parcial,
  };
}

describe("constantes do domínio", () => {
  it("001 - NIVEIS tem os cinco cotas na ordem esperada", () => {
    expect(NIVEIS).toEqual(["MASTER", "DIAMOND", "TITANIUM", "PLATINUM", "GOLD"]);
  });

  it("002 - CATEGORIAS inclui IA e Cibersegurança", () => {
    expect(CATEGORIAS).toContain("Inteligência Artificial");
    expect(CATEGORIAS).toContain("Cibersegurança");
    expect(CATEGORIAS.length).toBeGreaterThanOrEqual(5);
  });

  it("003 - GRUPOS_COMISSAO tem manhã com 6 e noite com 8 semestres", () => {
    expect(GRUPOS_COMISSAO.find((g) => g.value === "manha")?.semestres).toBe(6);
    expect(GRUPOS_COMISSAO.find((g) => g.value === "noite")?.semestres).toBe(8);
    expect(semestresDoGrupo("professor")).toBe(0);
    expect(semestresDoGrupo("5ano")).toBe(0);
  });
});

describe("normalizeUrl", () => {
  it("004 - devolve string vazia para entrada só com espaços", () => {
    expect(normalizeUrl("   ")).toBe("");
    expect(normalizeUrl("")).toBe("");
  });

  it("005 - preserva http e https já presentes", () => {
    expect(normalizeUrl("https://exemplo.com")).toBe("https://exemplo.com");
    expect(normalizeUrl("http://exemplo.com")).toBe("http://exemplo.com");
  });

  it("006 - prefixa https:// quando falta protocolo", () => {
    expect(normalizeUrl("exemplo.com/a")).toBe("https://exemplo.com/a");
    expect(normalizeUrl("  linkedin.com/in/x ")).toBe("https://linkedin.com/in/x");
  });
});

describe("initials", () => {
  it("007 - usa primeira letra de até dois nomes", () => {
    expect(initials("Maria Silva")).toBe("MS");
    expect(initials("João")).toBe("J");
  });

  it("008 - trata nome vazio e espaços extras", () => {
    expect(initials("")).toBe("?");
    expect(initials("  Ana   Paula  ")).toBe("AP");
  });
});

describe("formatDia e formatHora", () => {
  it("009 - formatDia formata YYYY-MM-DD em dia + mês abreviado", () => {
    expect(formatDia("2026-01-15")).toBe("15 Jan");
    expect(formatDia("2026-11-04")).toBe("4 Nov");
    expect(formatDia(null)).toBe("");
  });

  it("010 - formatHora corta segundos e trata null", () => {
    expect(formatHora("14:30:00")).toBe("14:30");
    expect(formatHora("09:05")).toBe("09:05");
    expect(formatHora(null)).toBe("");
  });
});

describe("compararTurmas", () => {
  it("011 - N/A fica depois de qualquer turma nomeada", () => {
    expect(compararTurmas(TURMA_NA, "1º ano")).toBeGreaterThan(0);
    expect(compararTurmas("1º ano", TURMA_NA)).toBeLessThan(0);
  });

  it("012 - ordena numericamente (2º antes de 10º)", () => {
    const lista = ["10º ano", "2º ano", "1º ano"].sort(compararTurmas);
    expect(lista).toEqual(["1º ano", "2º ano", "10º ano"]);
  });
});

describe("palestrantesDe e nomesPalestrantes", () => {
  it("013 - prioriza o array palestrantes quando preenchido", () => {
    const lista = palestrantesDe({
      palestrantes: [
        { nome: "Ana", cargo: "Dev", foto_url: null, sobre: null },
        { nome: "Bia", cargo: null, foto_url: "/b.png", sobre: "bio" },
      ],
      nome_completo: "Ignorado",
      cargo: null,
      sobre_palestrante: null,
      foto_url: null,
    });
    expect(lista).toHaveLength(2);
    expect(lista[0]?.nome).toBe("Ana");
    expect(nomesPalestrantes({
      palestrantes: lista,
      nome_completo: "",
      cargo: null,
      sobre_palestrante: null,
      foto_url: null,
    })).toBe("Ana, Bia");
  });

  it("014 - monta um palestrante a partir das colunas antigas", () => {
    const lista = palestrantesDe({
      palestrantes: null,
      nome_completo: "Carlos",
      cargo: "Prof",
      sobre_palestrante: "Sobre",
      foto_url: "foto.png",
    });
    expect(lista).toEqual([
      { nome: "Carlos", cargo: "Prof", foto_url: "foto.png", sobre: "Sobre" },
    ]);
  });

  it("015 - devolve lista vazia quando não há dados de palestrante", () => {
    expect(
      palestrantesDe({
        palestrantes: [],
        nome_completo: "",
        cargo: null,
        sobre_palestrante: null,
        foto_url: null,
      }),
    ).toEqual([]);
    expect(
      nomesPalestrantes({
        palestrantes: [{ nome: "  ", cargo: null, foto_url: null, sobre: null }],
        nome_completo: "",
        cargo: null,
        sobre_palestrante: null,
        foto_url: null,
      }),
    ).toBe("");
  });

  it("016 - aceita foto_url como array nas colunas antigas", () => {
    const lista = palestrantesDe({
      palestrantes: null,
      nome_completo: "Duda",
      cargo: null,
      sobre_palestrante: null,
      foto_url: ["a.png", "b.png"],
    });
    expect(lista[0]?.foto_url).toBe("a.png");
  });
});

describe("porSemestre", () => {
  const base = (parcial: Partial<MembroComissao>): MembroComissao => ({
    id: parcial.id ?? "1",
    nome: parcial.nome ?? "X",
    email: null,
    grupo: "manha",
    semestre: parcial.semestre ?? 1,
    created_at: "",
    updated_at: "",
    ...parcial,
  });

  it("017 - agrupa por semestre e ordena nomes em pt-BR", () => {
    const grupos = porSemestre([
      base({ id: "1", nome: "Zeca", semestre: 2 }),
      base({ id: "2", nome: "Ana", semestre: 2 }),
      base({ id: "3", nome: "Bia", semestre: 1 }),
    ]);
    expect(grupos.map((g) => g.semestre)).toEqual([1, 2]);
    expect(grupos[1]?.membros.map((m) => m.nome)).toEqual(["Ana", "Zeca"]);
  });

  it("018 - semestre nulo vai para o fim (chave 0)", () => {
    const grupos = porSemestre([
      base({ nome: "Sem", semestre: null }),
      base({ nome: "Com", semestre: 1 }),
    ]);
    expect(grupos[0]?.semestre).toBe(1);
    expect(grupos.at(-1)?.semestre).toBe(0);
  });
});

describe("presença: local, coordenadas e maps", () => {
  it("019 - coordenadasPresenca formata lat/lng e precisão", () => {
    expect(coordenadasPresenca(presenca())).toBeNull();
    expect(
      coordenadasPresenca(presenca({ latitude: -23.5, longitude: -46.6, precisao_m: 12.4 })),
    ).toBe("-23.50000, -46.60000 (±12 m)");
    expect(coordenadasPresenca(presenca({ latitude: 1, longitude: 2 }))).toBe(
      "1.00000, 2.00000",
    );
  });

  it("020 - formatLocalPresenca prioriza nome, depois coords, depois aviso", () => {
    expect(formatLocalPresenca(presenca({ localizacao: "Fatec" }))).toBe("Fatec");
    expect(
      formatLocalPresenca(presenca({ latitude: -23, longitude: -46, localizacao: null })),
    ).toContain("-23.00000");
    expect(formatLocalPresenca(presenca())).toBe("Localização não informada");
  });

  it("021 - mapsUrl só existe com coordenadas", () => {
    expect(mapsUrl(presenca())).toBeNull();
    expect(mapsUrl(presenca({ latitude: -23.5, longitude: -46.6 }))).toBe(
      "https://www.google.com/maps?q=-23.5,-46.6",
    );
  });

  it("022 - formatDataHora devolve string localizada não vazia", () => {
    const texto = formatDataHora("2026-11-04T15:30:00.000Z");
    expect(texto.length).toBeGreaterThan(5);
    expect(texto).toMatch(/\d/);
  });
});

describe("mensagemErro", () => {
  it("023 - usa o padrão quando não há mensagem", () => {
    expect(mensagemErro(null)).toBe("Ocorreu um erro");
    expect(mensagemErro({}, "Falha")).toBe("Falha");
  });

  it("024 - traduz credenciais inválidas e rede", () => {
    expect(mensagemErro({ message: "Invalid login credentials" })).toBe(
      "E-mail ou senha incorretos.",
    );
    expect(mensagemErro({ message: "Failed to fetch" })).toMatch(/conexão/i);
  });

  it("025 - traduz RLS, duplicata e payload grande", () => {
    expect(mensagemErro({ message: "row-level security policy" })).toMatch(/permissão/i);
    expect(mensagemErro({ message: "duplicate key", code: "23505" })).toMatch(/já existe/i);
    expect(mensagemErro({ message: "Payload too large" })).toMatch(/grande demais/i);
  });

  it("026 - passa adiante mensagem em português e string pura", () => {
    expect(mensagemErro({ message: "Vagas esgotadas" })).toBe("Vagas esgotadas");
    expect(mensagemErro("Algo estranho")).toBe("Algo estranho");
  });

  it("027 - traduz sessão expirada e rate limit", () => {
    expect(mensagemErro({ message: "JWT expired" })).toMatch(/sessão expirou/i);
    expect(mensagemErro({ message: "Too many requests" })).toMatch(/aguarde/i);
  });
});
