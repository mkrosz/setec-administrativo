import { jsPDF } from "jspdf";

import { supabase } from "@/integrations/supabase/client";
import { formatDia, formatHora, type EventConfig, type Palestra, type Patrocinador } from "@/lib/setec";

export type BackupData = {
  versao: 1;
  exportado_em: string;
  evento: EventConfig | null;
  palestras: Palestra[];
  apoiadores: Patrocinador[];
};

export async function coletarDados(): Promise<BackupData> {
  const [cfg, pal, pat] = await Promise.all([
    supabase.from("event_config").select("*").limit(1).maybeSingle(),
    supabase.from("palestras").select("*").order("data", { ascending: true }),
    supabase.from("patrocinadores").select("*").order("nivel", { ascending: true }),
  ]);
  if (cfg.error) throw cfg.error;
  if (pal.error) throw pal.error;
  if (pat.error) throw pat.error;
  return {
    versao: 1,
    exportado_em: new Date().toISOString(),
    evento: (cfg.data ?? null) as EventConfig | null,
    palestras: (pal.data ?? []) as Palestra[],
    apoiadores: (pat.data ?? []) as Patrocinador[],
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

export async function exportarPDF() {
  const dados = await coletarDados();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margem = 48;
  const largura = doc.internal.pageSize.getWidth() - margem * 2;
  let y = margem;

  const quebra = (altura: number) => {
    if (y + altura > doc.internal.pageSize.getHeight() - margem) {
      doc.addPage();
      y = margem;
    }
  };

  const linha = (texto: string, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const partes = doc.splitTextToSize(texto, largura) as string[];
    for (const parte of partes) {
      quebra(size + 6);
      doc.text(parte, margem, y);
      y += size + 6;
    }
  };

  linha("Semana de Tecnologia", 20, true);
  const ev = dados.evento;
  if (ev) linha(`Edição ${ev.edicao} • ${ev.ano} • ${ev.datas}`, 12);
  linha(`Exportado em ${new Date(dados.exportado_em).toLocaleString("pt-BR")}`, 9);
  y += 10;

  linha("Programação", 15, true);
  if (dados.palestras.length === 0) linha("Nenhuma palestra cadastrada.");
  for (const p of dados.palestras) {
    y += 6;
    linha(p.titulo, 12, true);
    linha(`${p.nome_completo}${p.cargo ? ` — ${p.cargo}` : ""}`, 10);
    linha(
      [formatDia(p.data), `${formatHora(p.hora_inicio)}-${formatHora(p.hora_fim)}`, p.local, p.categoria]
        .filter(Boolean)
        .join(" • "),
      10,
    );
    if (p.sobre_palestra) linha(p.sobre_palestra, 10);
  }

  y += 16;
  linha("Apoiadores", 15, true);
  if (dados.apoiadores.length === 0) linha("Nenhum apoiador cadastrado.");
  for (const a of dados.apoiadores) linha(`${a.nivel} — ${a.nome_empresa}`, 11);

  doc.save(`setec-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function importarJSON(file: File) {
  const texto = await file.text();
  const dados = JSON.parse(texto) as Partial<BackupData>;
  const palestras = Array.isArray(dados.palestras) ? dados.palestras : [];
  const apoiadores = Array.isArray(dados.apoiadores) ? dados.apoiadores : [];

  if (dados.evento) {
    const { data: atual } = await supabase.from("event_config").select("id").limit(1).maybeSingle();
    if (atual) {
      const { id: _id, ...resto } = dados.evento as EventConfig & { created_at?: string };
      const { error } = await supabase.from("event_config").update(resto).eq("id", atual.id);
      if (error) throw error;
    }
  }

  if (palestras.length) {
    const { error } = await supabase.from("palestras").upsert(palestras);
    if (error) throw error;
  }
  if (apoiadores.length) {
    const { error } = await supabase.from("patrocinadores").upsert(apoiadores);
    if (error) throw error;
  }

  return { palestras: palestras.length, apoiadores: apoiadores.length };
}
