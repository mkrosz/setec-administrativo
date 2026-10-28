// Supabase Edge Function: apaga do Storage as imagens que estão há 12 meses sem uso.
//
// Roda uma vez por dia (pg_cron, ver supabase/sql/limpeza-imagens.sql). A cada execução:
//   1. lista os arquivos das pastas do painel no bucket (palestrantes/, ministrantes/,
//      patrocinadores/, evento/);
//   2. junta as imagens usadas por palestras, minicursos, apoiadores e logo do evento;
//   3. arquivo sem uso entra em storage_imagens_orfas com a data de hoje; se voltar a ser
//      usado (ex.: importação de um backup), sai da lista e o prazo recomeça;
//   4. arquivos sem uso há 12 meses ou mais são apagados do Storage.
// Se qualquer consulta falhar, nada é marcado nem apagado.
// Envie {"simular": true} para ver o resultado sem alterar nada.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const BUCKET = "setec-bucket";
const MESES_SEM_USO = 12;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/** "palestrantes/a.jpg", "/palestrantes/a.jpg" ou a URL pública completa → "palestrantes/a.jpg". */
export function caminhoDoStorage(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  let v = valor.trim();
  if (!v) return null;
  const marcador = `/${BUCKET}/`;
  const i = v.indexOf(marcador);
  if (i >= 0) v = v.slice(i + marcador.length);
  else if (/^https?:\/\//i.test(v)) return null; // imagem de fora do Storage
  v = v.replace(/^\/+/, "").split("?")[0]!;
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** Lê uma tabela; tabela que não existe (SQL não rodado) conta como vazia, outros erros param tudo. */
async function linhas(tabela: string, colunas: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase.from(tabela).select(colunas);
  if (error) {
    // tabela ou coluna inexistente (SQL não rodado): conta como vazia
    if (["PGRST205", "42P01", "42703", "PGRST204"].includes(error.code)) return [];
    throw new Error(`${tabela}: ${error.message}`);
  }
  return (data ?? []) as unknown as Record<string, unknown>[];
}

/** Caminhos de todas as imagens usadas hoje pelo painel/site. */
async function imagensEmUso(): Promise<Set<string>> {
  const usados = new Set<string>();
  const add = (v: unknown) => {
    const c = caminhoDoStorage(v);
    if (c) usados.add(c);
  };
  const pessoas = (lista: unknown) => {
    if (Array.isArray(lista)) for (const p of lista) add((p as Record<string, unknown>)?.foto_url);
  };

  for (const p of await linhas("palestras", "foto_url, palestrantes")) {
    if (Array.isArray(p.foto_url)) p.foto_url.forEach(add);
    else add(p.foto_url);
    pessoas(p.palestrantes);
  }
  for (const m of await linhas("minicursos", "ministrantes")) pessoas(m.ministrantes);
  for (const a of await linhas("patrocinadores", "logo_url")) add(a.logo_url);
  for (const e of await linhas("event_config", "logo_url")) add(e.logo_url);
  for (const c of await linhas("configuracoes", "logo_url")) add(c.logo_url);
  return usados;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });
  let simular = false;
  try {
    simular = !!(await req.json())?.simular;
  } catch {
    /* sem corpo */
  }

  try {
    const { data: objetos, error: e1 } = await supabase.rpc("storage_objetos_setec");
    if (e1) throw new Error(`storage_objetos_setec: ${e1.message}`);
    const arquivos = new Set(((objetos ?? []) as { caminho: string }[]).map((o) => o.caminho));

    const usados = await imagensEmUso();

    const { data: orfasAtuais, error: e2 } = await supabase
      .from("storage_imagens_orfas")
      .select("caminho, orfa_desde");
    if (e2) throw new Error(`storage_imagens_orfas: ${e2.message}`);
    const jaOrfas = new Map(
      (orfasAtuais ?? []).map((o) => [o.caminho as string, new Date(o.orfa_desde as string)]),
    );

    const semUso = [...arquivos].filter((c) => !usados.has(c));
    const novas = semUso.filter((c) => !jaOrfas.has(c));
    // Saem da lista: voltaram a ser usadas ou o arquivo já não existe
    const sair = [...jaOrfas.keys()].filter((c) => usados.has(c) || !arquivos.has(c));

    const limite = new Date();
    limite.setMonth(limite.getMonth() - MESES_SEM_USO);
    const apagar = semUso.filter((c) => {
      const desde = jaOrfas.get(c);
      return desde !== undefined && desde <= limite;
    });

    if (!simular) {
      if (novas.length) {
        const { error } = await supabase.from("storage_imagens_orfas").upsert(
          novas.map((caminho) => ({ caminho })),
          { onConflict: "caminho", ignoreDuplicates: true },
        );
        if (error) throw error;
      }
      if (sair.length) {
        const { error } = await supabase.from("storage_imagens_orfas").delete().in("caminho", sair);
        if (error) throw error;
      }
      for (let i = 0; i < apagar.length; i += 100) {
        const lote = apagar.slice(i, i + 100);
        const { error } = await supabase.storage.from(BUCKET).remove(lote);
        if (error) throw error;
        await supabase.from("storage_imagens_orfas").delete().in("caminho", lote);
      }
    }

    const resumo = {
      ok: true,
      simulacao: simular,
      arquivos: arquivos.size,
      emUso: [...arquivos].filter((c) => usados.has(c)).length,
      semUso: semUso.length,
      novasSemUso: novas.length,
      voltaramAoUso: sair.length,
      apagadas: apagar.length,
      ...(simular ? { seriamApagadas: apagar } : {}),
    };
    console.log("limpar-imagens:", JSON.stringify(resumo));
    return new Response(JSON.stringify(resumo), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("limpar-imagens:", msg);
    return new Response(JSON.stringify({ ok: false, erro: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
