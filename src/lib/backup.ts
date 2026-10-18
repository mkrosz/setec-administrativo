import { jsPDF } from "jspdf";

import { supabase } from "@/integrations/supabase/client";
import {
  GRUPOS_COMISSAO,
  NIVEIS,
  formatHora,
  palestrantesDe,
  type EventConfig,
  type InscricaoMinicurso,
  type MembroComissao,
  type Minicurso,
  type Palestra,
  type Palestrante,
  type Patrocinador,
  type Presenca,
  type Turma,
} from "@/lib/setec";

export type BackupData = {
  /** 1 = palestras/apoiadores/comissão; 2 = também minicursos, inscrições, turmas e presenças. */
  versao: 1 | 2;
  exportado_em: string;
  evento: EventConfig | null;
  palestras: Palestra[];
  apoiadores: Patrocinador[];
  /** Os campos abaixo são opcionais: backups antigos não têm. */
  comissao?: MembroComissao[];
  minicursos?: Minicurso[];
  minicurso_inscricoes?: InscricaoMinicurso[];
  presenca_turmas?: Turma[];
  presencas?: Presenca[];
};

/** Lê uma tabela opcional; se ela ainda não existir no banco (SQL não rodado), devolve []. */
async function tabelaOpcional<T>(tabela: string, ordem: string): Promise<T[]> {
  const { data, error } = await supabase
    .from(tabela as any)
    .select("*")
    .order(ordem, { ascending: true });
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return [];
    throw error;
  }
  return (data ?? []) as unknown as T[];
}

export async function coletarDados(): Promise<BackupData> {
  const [cfg, pal, pat, comissao, minicursos, inscricoes, turmas, presencas] = await Promise.all([
    supabase.from("event_config").select("*").limit(1).maybeSingle(),
    supabase.from("palestras").select("*").order("data", { ascending: true }),
    supabase.from("patrocinadores").select("*").order("nivel", { ascending: true }),
    tabelaOpcional<MembroComissao>("comissao", "nome"),
    tabelaOpcional<Minicurso>("minicursos", "data"),
    tabelaOpcional<InscricaoMinicurso>("minicurso_inscricoes", "created_at"),
    tabelaOpcional<Turma>("presenca_turmas", "nome"),
    tabelaOpcional<Presenca>("presencas", "registrado_em"),
  ]);
  if (cfg.error) throw cfg.error;
  if (pal.error) throw pal.error;
  if (pat.error) throw pat.error;
  return {
    versao: 2,
    exportado_em: new Date().toISOString(),
    evento: (cfg.data ?? null) as EventConfig | null,
    palestras: (pal.data ?? []) as Palestra[],
    apoiadores: (pat.data ?? []) as Patrocinador[],
    comissao,
    minicursos,
    minicurso_inscricoes: inscricoes,
    presenca_turmas: turmas,
    presencas,
  };
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportarJSON() {
  const dados = await coletarDados();
  const stamp = new Date().toISOString().slice(0, 10);
  baixar(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }), `setec-${stamp}.json`);
}

const ROXO: [number, number, number] = [112, 72, 200];
const ROXO_CLARO: [number, number, number] = [244, 241, 251];
const TEXTO: [number, number, number] = [24, 24, 32];
const CINZA: [number, number, number] = [110, 110, 120];
const LINHA: [number, number, number] = [225, 222, 235];

const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "Segunda-feira, 5 de Outubro" a partir de "2026-10-05". */
function rotuloDia(data: string) {
  const [a, m, d] = data.split("-").map(Number);
  const dt = new Date(a ?? 2000, (m ?? 1) - 1, d ?? 1);
  return `${DIAS_SEMANA[dt.getDay()]}, ${d} de ${MESES[dt.getMonth()]}`;
}

/** Monta o relatório do evento: programação por dia, apoiadores por nível e comissão. */
export function gerarRelatorioPDF(dados: BackupData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margem = 44;
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const largura = larguraPagina - margem * 2;
  const limite = alturaPagina - margem - 14; // deixa espaço para o rodapé
  let y = margem;
  const fonte = (size: number, estilo: "normal" | "bold" = "normal", cor = TEXTO) => {
    doc.setFont("helvetica", estilo);
    doc.setFontSize(size);
    doc.setTextColor(...cor);
  };
  const quebrar = (texto: string, w: number) => doc.splitTextToSize(texto, w) as string[];

  /** Abre nova página se o bloco não couber. */
  const garantir = (altura: number) => {
    if (y + altura <= limite) return;
    doc.addPage();
    y = margem;
  };

  function tituloSecao(texto: string) {
    if (y + 90 > limite) {
      doc.addPage();
      y = margem;
    } else {
      y += 22;
    }
    doc.setFillColor(...ROXO);
    doc.rect(margem, y, 4, 18, "F");
    fonte(15, "bold");
    doc.text(texto, margem + 12, y + 14);
    y += 30;
  }

  function subtitulo(texto: string, extra?: string) {
    garantir(48);
    doc.setFillColor(...ROXO_CLARO);
    doc.roundedRect(margem, y, largura, 22, 4, 4, "F");
    fonte(9.5, "bold", ROXO);
    doc.text(texto.toUpperCase(), margem + 10, y + 14.5);
    if (extra) {
      fonte(9, "normal", CINZA);
      doc.text(extra, margem + largura - 10, y + 14.5, { align: "right" });
    }
    y += 32;
  }

  function vazio(texto: string) {
    fonte(10, "normal", CINZA);
    doc.text(texto, margem, y + 6);
    y += 16;
  }

  // ---------- Cabeçalho ----------
  const ev = dados.evento;
  doc.setFillColor(...ROXO);
  doc.rect(0, 0, larguraPagina, 6, "F");
  fonte(9, "bold", CINZA);
  doc.text(`SEMANA DE TECNOLOGIA${ev?.edicao ? `  •  EDIÇÃO ${ev.edicao}` : ""}`, margem, (y += 6));
  fonte(24, "bold");
  doc.text("Relatório do Evento", margem, (y += 28));
  fonte(11, "normal", CINZA);
  const periodo = [ev?.datas && `${ev.datas}${ev.ano ? ` de ${ev.ano}` : ""}`, "FATEC Sorocaba"]
    .filter(Boolean)
    .join("  •  ");
  doc.text(periodo, margem, (y += 18));
  y += 16;

  const publicadas = dados.palestras
    .filter((p) => !p.rascunho)
    .sort(
      (a, b) =>
        (a.data ?? "9999").localeCompare(b.data ?? "9999") ||
        (a.hora_inicio ?? "").localeCompare(b.hora_inicio ?? ""),
    );
  const rascunhos = dados.palestras.filter((p) => p.rascunho);
  const minicursos = (dados.minicursos ?? [])
    .filter((m) => !m.rascunho)
    .sort(
      (a, b) =>
        (a.data ?? "9999").localeCompare(b.data ?? "9999") ||
        (a.hora_inicio ?? "").localeCompare(b.hora_inicio ?? ""),
    );
  const rascunhosMini = (dados.minicursos ?? []).filter((m) => m.rascunho);
  const comissao = dados.comissao ?? [];

  const contar = (ids: string[]) => {
    const mapa = new Map<string, number>();
    for (const id of ids) mapa.set(id, (mapa.get(id) ?? 0) + 1);
    return mapa;
  };
  const presentesPorPalestra = contar((dados.presencas ?? []).map((p) => p.palestra_id));
  const inscritosPorMinicurso = contar((dados.minicurso_inscricoes ?? []).map((i) => i.minicurso_id));
  const totalPalestrantes = new Set(
    publicadas
      .flatMap((p) => palestrantesDe(p).map((sp) => sp.nome.trim().toLowerCase()))
      .filter(Boolean),
  ).size;

  // Resumo em cartões
  const cartoes = [
    { n: publicadas.length, rotulo: "Palestras" },
    { n: minicursos.length, rotulo: "Minicursos" },
    { n: totalPalestrantes, rotulo: "Palestrantes" },
    { n: dados.apoiadores.length, rotulo: "Apoiadores" },
    { n: comissao.length, rotulo: "Comissão" },
  ];
  const gapCartao = 8;
  const wCartao = (largura - gapCartao * (cartoes.length - 1)) / cartoes.length;
  cartoes.forEach((c, i) => {
    const x = margem + i * (wCartao + gapCartao);
    doc.setDrawColor(...LINHA);
    doc.setFillColor(...ROXO_CLARO);
    doc.roundedRect(x, y, wCartao, 52, 6, 6, "FD");
    fonte(18, "bold", ROXO);
    doc.text(String(c.n), x + 11, y + 26);
    fonte(7.5, "bold", CINZA);
    doc.text(c.rotulo.toUpperCase(), x + 11, y + 42);
  });
  y += 52;

  type ItemGrade = {
    data: string | null;
    titulo: string;
    pessoas: Palestrante[];
    hora_inicio: string | null;
    hora_fim: string | null;
    meta: string;
    /** Texto em roxo no fim da linha de detalhes (presentes, vagas...). */
    destaque?: string | undefined;
  };

  const colHora = 70;
  const xConteudo = margem + colHora;
  const wConteudo = largura - colHora;

  /** Grade por dia (usada por palestras e minicursos). */
  function grade(itens: ItemGrade[], singular: string, plural: string) {
    const porDia = new Map<string, ItemGrade[]>();
    for (const it of itens) {
      const k = it.data ?? "";
      porDia.set(k, [...(porDia.get(k) ?? []), it]);
    }

    for (const [data, lista] of porDia) {
      subtitulo(
        data ? rotuloDia(data) : "Sem data definida",
        `${lista.length} ${lista.length > 1 ? plural : singular}`,
      );

      for (const it of lista) {
        fonte(11, "bold");
        const titulo = quebrar(it.titulo || "(Sem título)", wConteudo);
        fonte(9.5, "normal");
        const pessoas = it.pessoas.flatMap((sp) =>
          quebrar(`${sp.nome || "(Sem nome)"}${sp.cargo ? ` — ${sp.cargo}` : ""}`, wConteudo),
        );
        const temMeta = !!(it.meta || it.destaque);
        const altura = Math.max(titulo.length * 14 + pessoas.length * 12.5 + (temMeta ? 13 : 0) + 14, 40);
        garantir(altura);

        const topo = y;
        fonte(10.5, "bold", ROXO);
        doc.text(formatHora(it.hora_inicio) || "--:--", margem, topo + 11);
        if (it.hora_fim) {
          fonte(8.5, "normal", CINZA);
          doc.text(`até ${formatHora(it.hora_fim)}`, margem, topo + 23);
        }

        let yy = topo + 11;
        fonte(11, "bold");
        for (const l of titulo) {
          doc.text(l, xConteudo, yy);
          yy += 14;
        }
        fonte(9.5, "normal");
        for (const l of pessoas) {
          doc.text(l, xConteudo, yy);
          yy += 12.5;
        }
        if (temMeta) {
          let x = xConteudo;
          if (it.meta) {
            fonte(8.5, "normal", CINZA);
            doc.text(it.meta, x, yy + 1);
            x += doc.getTextWidth(it.meta) + (it.destaque ? 10 : 0);
          }
          if (it.destaque) {
            fonte(8.5, "bold", ROXO);
            doc.text(`${it.meta ? "•  " : ""}${it.destaque}`, x, yy + 1);
          }
        }

        y = topo + altura;
        doc.setDrawColor(...LINHA);
        doc.line(margem, y - 8, margem + largura, y - 8);
      }
      y += 4;
    }
  }

  /** Lista simples de rascunhos (título — pessoas). */
  function listaRascunhos(itens: { titulo: string; pessoas: Palestrante[] }[]) {
    subtitulo("Rascunhos (não publicados)", `${itens.length}`);
    for (const it of itens) {
      const nomes = it.pessoas
        .map((sp) => sp.nome)
        .filter(Boolean)
        .join(", ");
      fonte(9.5, "normal", CINZA);
      const linhas = quebrar(`${it.titulo || "(Sem título)"}${nomes ? ` — ${nomes}` : ""}`, largura - 16);
      garantir(linhas.length * 12.5 + 4);
      linhas.forEach((l, i) => {
        doc.text(l, margem + 12, y + 9);
        if (i === 0) {
          doc.setFillColor(...CINZA);
          doc.circle(margem + 4, y + 5.5, 1.6, "F");
        }
        y += 12.5;
      });
      y += 3;
    }
  }

  // ---------- Programação (palestras) ----------
  tituloSecao("Programação");
  if (publicadas.length === 0) vazio("Nenhuma palestra publicada.");
  grade(
    publicadas.map((p) => {
      const presentes = presentesPorPalestra.get(p.id) ?? 0;
      return {
        data: p.data,
        titulo: p.titulo,
        pessoas: palestrantesDe(p),
        hora_inicio: p.hora_inicio,
        hora_fim: p.hora_fim,
        meta: [p.local, p.categoria].filter(Boolean).join("  •  "),
        destaque: presentes ? `${presentes} ${presentes === 1 ? "presente" : "presentes"}` : undefined,
      };
    }),
    "palestra",
    "palestras",
  );
  if (rascunhos.length > 0) {
    listaRascunhos(rascunhos.map((p) => ({ titulo: p.titulo, pessoas: palestrantesDe(p) })));
  }

  // ---------- Minicursos ----------
  if (minicursos.length > 0 || rascunhosMini.length > 0) {
    tituloSecao("Minicursos");
    if (minicursos.length === 0) vazio("Nenhum minicurso publicado.");
    grade(
      minicursos.map((m) => {
        const inscritos = inscritosPorMinicurso.get(m.id) ?? 0;
        return {
          data: m.data,
          titulo: m.titulo,
          pessoas: m.ministrantes ?? [],
          hora_inicio: m.hora_inicio,
          hora_fim: m.hora_fim,
          meta: [m.local, m.categoria].filter(Boolean).join("  •  "),
          destaque: `${inscritos}/${m.vagas} inscritos${inscritos >= m.vagas ? " (esgotado)" : ""}`,
        };
      }),
      "minicurso",
      "minicursos",
    );
    if (rascunhosMini.length > 0) {
      listaRascunhos(rascunhosMini.map((m) => ({ titulo: m.titulo, pessoas: m.ministrantes ?? [] })));
    }
  }

  // ---------- Apoiadores ----------
  tituloSecao("Apoiadores");
  const conhecidos = NIVEIS as readonly string[];
  const niveis = [
    ...conhecidos,
    ...new Set(dados.apoiadores.map((a) => a.nivel).filter((n) => !conhecidos.includes(n))),
  ];
  const colunasApoio = 3;
  const wApoio = largura / colunasApoio;
  if (dados.apoiadores.length === 0) vazio("Nenhum apoiador cadastrado.");
  for (const nivel of niveis) {
    const lista = dados.apoiadores
      .filter((a) => a.nivel === nivel)
      .sort((a, b) => a.nome_empresa.localeCompare(b.nome_empresa, "pt-BR"));
    if (lista.length === 0) continue;
    subtitulo(nivel, `${lista.length}`);
    for (let i = 0; i < lista.length; i += colunasApoio) {
      garantir(18);
      lista.slice(i, i + colunasApoio).forEach((a, j) => {
        const x = margem + j * wApoio;
        doc.setFillColor(...ROXO);
        doc.circle(x + 4, y + 5.5, 2, "F");
        fonte(10, "normal");
        doc.text(quebrar(a.nome_empresa, wApoio - 20)[0] ?? "", x + 12, y + 9);
      });
      y += 17;
    }
    y += 6;
  }

  // ---------- Comissão ----------
  tituloSecao("Comissão Organizadora");
  if (comissao.length === 0) vazio("Nenhum membro cadastrado.");
  const wNome = largura * 0.48;
  for (const g of GRUPOS_COMISSAO) {
    const semestral = g.semestres > 0;
    // Cursos semestrais: ordena por semestre e mostra o semestre na coluna da direita
    const lista = comissao
      .filter((m) => m.grupo === g.value)
      .sort(
        (a, b) =>
          (semestral ? (a.semestre ?? 99) - (b.semestre ?? 99) : 0) ||
          a.nome.localeCompare(b.nome, "pt-BR"),
      );
    if (lista.length === 0) continue;
    subtitulo(semestral ? `Curso da ${g.label}` : g.label, `${lista.length}`);
    const wEmail = semestral ? largura - wNome - 90 : largura - wNome - 10;
    lista.forEach((m, i) => {
      garantir(20);
      if (i % 2 === 1) {
        doc.setFillColor(250, 249, 253);
        doc.rect(margem, y - 3, largura, 18, "F");
      }
      fonte(10, "normal");
      doc.text(quebrar(m.nome, wNome - 16)[0] ?? "", margem + 10, y + 9);
      fonte(9, "normal", CINZA);
      doc.text(quebrar(m.email || "—", wEmail)[0] ?? "", margem + wNome, y + 9);
      if (semestral && m.semestre) {
        fonte(9, "bold", ROXO);
        doc.text(`${m.semestre}º semestre`, margem + largura - 10, y + 9, { align: "right" });
      }
      y += 18;
    });
    y += 8;
  }

  // ---------- Rodapé ----------
  const paginas = doc.getNumberOfPages();
  const gerado = `Gerado em ${new Date(dados.exportado_em).toLocaleString("pt-BR")}`;
  for (let n = 1; n <= paginas; n++) {
    doc.setPage(n);
    doc.setDrawColor(...LINHA);
    doc.line(margem, alturaPagina - 34, larguraPagina - margem, alturaPagina - 34);
    fonte(8, "normal", CINZA);
    doc.text(`SETEC${ev?.edicao ? ` ${ev.edicao}` : ""}  •  ${gerado}`, margem, alturaPagina - 20);
    doc.text(`Página ${n} de ${paginas}`, larguraPagina - margem, alturaPagina - 20, {
      align: "right",
    });
  }

  return doc;
}

export async function exportarPDF() {
  const dados = await coletarDados();
  gerarRelatorioPDF(dados).save(`setec-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Lê e valida um arquivo de backup; erros com mensagem em português. */
export async function lerBackup(file: File): Promise<Partial<BackupData>> {
  let dados: unknown;
  try {
    dados = JSON.parse(await file.text());
  } catch {
    throw new Error("O arquivo não é um backup válido (JSON corrompido ou de outro tipo).");
  }
  const d = dados as Partial<BackupData> | null;
  if (!d || typeof d !== "object" || (!Array.isArray(d.palestras) && !Array.isArray(d.apoiadores))) {
    throw new Error("Este arquivo não parece ser um backup da SETEC.");
  }
  return d;
}

/** Quantidades do backup, para mostrar antes de importar. */
export function resumoBackup(d: Partial<BackupData>) {
  const n = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  return {
    exportadoEm: d.exportado_em ? new Date(d.exportado_em).toLocaleString("pt-BR") : null,
    evento: !!d.evento,
    palestras: n(d.palestras),
    presencas: n(d.presencas),
    minicursos: n(d.minicursos),
    inscricoes: n(d.minicurso_inscricoes),
    apoiadores: n(d.apoiadores),
    comissao: n(d.comissao),
  };
}

export async function importarJSON(file: File) {
  const dados = await lerBackup(file);
  const palestras = Array.isArray(dados.palestras) ? dados.palestras : [];
  const apoiadores = Array.isArray(dados.apoiadores) ? dados.apoiadores : [];
  const comissao = Array.isArray(dados.comissao) ? dados.comissao : [];
  const minicursos = Array.isArray(dados.minicursos) ? dados.minicursos : [];
  const inscricoes = Array.isArray(dados.minicurso_inscricoes) ? dados.minicurso_inscricoes : [];
  const turmas = Array.isArray(dados.presenca_turmas) ? dados.presenca_turmas : [];
  const presencas = Array.isArray(dados.presencas) ? dados.presencas : [];

  if (dados.evento) {
    const { data: atual } = await supabase.from("event_config").select("id").limit(1).maybeSingle();
    if (atual) {
      const { id: _id, ...resto } = dados.evento as EventConfig & { created_at?: string };
      const { error } = await supabase.from("event_config").update(resto).eq("id", atual.id);
      if (error) throw error;
    }
  }

  if (palestras.length) {
    // Backups antigos não têm "palestrantes": monta a lista a partir das colunas antigas
    const linhas = palestras.map((p) => ({ ...p, palestrantes: palestrantesDe(p) }));
    const { error } = await supabase.from("palestras").upsert(linhas as any);
    if (error) throw error;
  }
  if (apoiadores.length) {
    const { error } = await supabase.from("patrocinadores").upsert(apoiadores as any);
    if (error) throw error;
  }

  // A ordem importa: minicursos antes das inscrições, palestras/turmas antes das presenças
  const restaurar = async (tabela: string, linhas: unknown[]) => {
    if (!linhas.length) return;
    const { error } = await supabase.from(tabela as any).upsert(linhas as any);
    if (error) throw new Error(`${tabela}: ${error.message}`);
  };
  await restaurar("comissao", comissao);
  await restaurar("minicursos", minicursos);
  // Inscrições que já tinham e-mail enviado não recebem outro (a função confere email_enviado_em)
  await restaurar("minicurso_inscricoes", inscricoes);
  await restaurar("presenca_turmas", turmas);
  // Os QR Codes não vão no backup: a presença volta sem o vínculo com o QR Code
  await restaurar(
    "presencas",
    presencas.map((p) => ({ ...p, qrcode_id: null })),
  );

  return {
    palestras: palestras.length,
    apoiadores: apoiadores.length,
    comissao: comissao.length,
    minicursos: minicursos.length,
    inscricoes: inscricoes.length,
    presencas: presencas.length,
  };
}
