import { jsPDF } from "jspdf";

import { formatDataHora, formatDia, formatHora, type InscricaoMinicurso, type Minicurso } from "@/lib/setec";

const ROXO: [number, number, number] = [112, 72, 200];
const CINZA: [number, number, number] = [110, 110, 120];

/** Gera e baixa o PDF com a lista de inscritos de um minicurso. */
export function exportarInscritosMinicurso(minicurso: Minicurso, inscritos: InscricaoMinicurso[]) {
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
  doc.text("SEMANA DE TECNOLOGIA  •  MINICURSO", margem, (y += 4));
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 28);
  doc.text("Lista de Inscritos", margem, (y += 24));

  doc.setFontSize(13);
  const titulo = doc.splitTextToSize(minicurso.titulo || "(Sem título)", largura) as string[];
  for (const parte of titulo) doc.text(parte, margem, (y += 20));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CINZA);
  const ministrantes = (minicurso.ministrantes ?? []).map((m) => m.nome).filter(Boolean);
  const detalhes = [
    ministrantes.length &&
      `${ministrantes.length > 1 ? "Ministrantes" : "Ministrante"}: ${ministrantes.join(", ")}`,
    minicurso.data && formatDia(minicurso.data),
    minicurso.hora_inicio &&
      `${formatHora(minicurso.hora_inicio)}${minicurso.hora_fim ? ` - ${formatHora(minicurso.hora_fim)}` : ""}`,
    minicurso.local && `Local: ${minicurso.local}`,
  ]
    .filter(Boolean)
    .join("   •   ");
  if (detalhes) doc.text(detalhes, margem, (y += 16));
  doc.text(
    `Inscritos: ${inscritos.length} de ${minicurso.vagas} vagas   •   Gerado em ${new Date().toLocaleString("pt-BR")}`,
    margem,
    (y += 14),
  );
  y += 18;

  // Tabela
  const colunas = [
    { titulo: "#", largura: 28 },
    { titulo: "Nome completo", largura: 220 },
    { titulo: "RA", largura: 100 },
    { titulo: "E-mail", largura: 0 },
    { titulo: "Turma", largura: 90 },
    { titulo: "Inscrito em", largura: 110 },
  ];
  colunas[3]!.largura = largura - colunas.reduce((s, c) => s + c.largura, 0);

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

  if (inscritos.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...CINZA);
    doc.text("Nenhuma inscrição.", margem + 6, y + 18);
  }

  inscritos.forEach((i, idx) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const celulas = [
      String(idx + 1),
      i.origem === "manual" ? `${i.nome_completo} (manual)` : i.nome_completo,
      i.ra,
      i.email,
      i.turma,
      formatDataHora(i.created_at),
    ].map((texto, c) => doc.splitTextToSize(texto, colunas[c]!.largura - 12) as string[]);
    const alturaLinha = Math.max(...celulas.map((c) => c.length)) * 11 + 10;

    if (y + alturaLinha > alturaPagina - margem) {
      doc.addPage();
      y = margem;
      cabecalhoTabela();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(244, 241, 251);
      doc.rect(margem, y, largura, alturaLinha, "F");
    }
    doc.setTextColor(30, 30, 38);
    let x = margem;
    celulas.forEach((linhas, c) => {
      doc.text(linhas, x + 6, y + 15, { lineHeightFactor: 11 / 9 });
      x += colunas[c]!.largura;
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
    doc.text(`Página ${n} de ${paginas}`, larguraPagina - margem, alturaPagina - 20, { align: "right" });
  }

  const slug = (minicurso.titulo || "minicurso")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  doc.save(`inscritos-${minicurso.data ?? "sem-data"}-${slug}.pdf`);
}
