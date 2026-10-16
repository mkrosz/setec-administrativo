import { jsPDF } from "jspdf";

import {
  formatDataHora,
  formatDia,
  formatHora,
  formatLocalPresenca,
  mapsUrl,
  type EventConfig,
  type Palestra,
  type Presenca,
} from "@/lib/setec";

const ROXO: [number, number, number] = [112, 72, 200];
const CINZA: [number, number, number] = [110, 110, 120];

/** Gera e baixa o PDF da lista de presença de uma palestra (toda ou de uma turma). */
export function exportarListaPresenca(
  palestra: Palestra,
  presencas: Presenca[],
  evento: EventConfig | null,
  turma?: string,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const margem = 40;
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const largura = larguraPagina - margem * 2;
  let y = margem;

  // Cabeçalho
  doc.setFillColor(...ROXO);
  doc.rect(0, 0, larguraPagina, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...CINZA);
  doc.text(
    `SEMANA DE TECNOLOGIA${evento ? ` • EDIÇÃO ${evento.edicao} • ${evento.ano}` : ""}`,
    margem,
    (y += 4),
  );
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 28);
  doc.text("Lista de Presença", margem, (y += 24));

  doc.setFontSize(13);
  const titulo = doc.splitTextToSize(palestra.titulo || "(Sem título)", largura) as string[];
  for (const parte of titulo) doc.text(parte, margem, (y += 20));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CINZA);
  const detalhes = [
    palestra.nome_completo && `Palestrante: ${palestra.nome_completo}`,
    palestra.data && formatDia(palestra.data),
    palestra.hora_inicio &&
      palestra.hora_fim &&
      `${formatHora(palestra.hora_inicio)} - ${formatHora(palestra.hora_fim)}`,
    palestra.local && `Local: ${palestra.local}`,
  ]
    .filter(Boolean)
    .join("   •   ");
  if (detalhes) doc.text(detalhes, margem, (y += 16));
  doc.text(
    `${turma ? `Turma: ${turma}   •   ` : ""}Total de presentes: ${presencas.length}   •   Gerado em ${new Date().toLocaleString("pt-BR")}`,
    margem,
    (y += 14),
  );
  y += 18;

  // Tabela
  const colunas = [
    { titulo: "#", largura: 28 },
    { titulo: "Nome completo", largura: 210 },
    { titulo: "RA", largura: 100 },
    { titulo: "Turma", largura: 80 },
    { titulo: "Registrado em", largura: 110 },
    { titulo: "Local da submissão", largura: 0 },
  ];
  colunas[colunas.length - 1]!.largura =
    largura - colunas.slice(0, -1).reduce((s, c) => s + c.largura, 0);

  const cabecalhoTabela = () => {
    doc.setFillColor(...ROXO);
    doc.rect(margem, y, largura, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    let x = margem;
    for (const c of colunas) {
      doc.text(c.titulo.toUpperCase(), x + 6, y + 14);
      x += c.largura;
    }
    y += 22;
  };

  cabecalhoTabela();

  if (presencas.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...CINZA);
    doc.text("Nenhuma presença registrada.", margem + 6, y + 18);
  }

  presencas.forEach((p, i) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const local = formatLocalPresenca(p);
    const celulas = [
      String(i + 1),
      p.nome_completo,
      p.ra,
      p.ano_turma,
      formatDataHora(p.registrado_em),
      p.origem === "manual" ? `${local} (manual)` : local,
    ].map((texto, idx) => doc.splitTextToSize(texto, colunas[idx]!.largura - 12) as string[]);
    const alturaLinha = Math.max(...celulas.map((c) => c.length)) * 11 + 10;

    if (y + alturaLinha > alturaPagina - margem) {
      doc.addPage();
      y = margem;
      cabecalhoTabela();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }

    if (i % 2 === 1) {
      doc.setFillColor(244, 241, 251);
      doc.rect(margem, y, largura, alturaLinha, "F");
    }
    doc.setTextColor(30, 30, 38);
    let x = margem;
    celulas.forEach((linhas, idx) => {
      const url = idx === celulas.length - 1 ? mapsUrl(p) : null;
      if (url) {
        doc.setTextColor(...ROXO);
        linhas.forEach((l, li) => doc.textWithLink(l, x + 6, y + 15 + li * 11, { url }));
        doc.setTextColor(30, 30, 38);
      } else {
        doc.text(linhas, x + 6, y + 15, { lineHeightFactor: 11 / 9 });
      }
      x += colunas[idx]!.largura;
    });
    doc.setDrawColor(225, 222, 235);
    doc.line(margem, y + alturaLinha, margem + largura, y + alturaLinha);
    y += alturaLinha;
  });

  // Rodapé com paginação
  const paginas = doc.getNumberOfPages();
  for (let n = 1; n <= paginas; n++) {
    doc.setPage(n);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(`Página ${n} de ${paginas}`, larguraPagina - margem, alturaPagina - 20, {
      align: "right",
    });
  }

  const slug = (palestra.titulo || "palestra")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const sufixo = turma
    ? `-${turma
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`
    : "";
  doc.save(`presenca-${palestra.data ?? "sem-data"}-${slug}${sufixo}.pdf`);
}
