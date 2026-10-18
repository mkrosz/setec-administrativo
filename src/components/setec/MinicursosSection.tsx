import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, ListChecks, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AvataresPessoas } from "@/components/setec/AvataresPessoas";
import { useConfirmar } from "@/components/setec/ConfirmDialog";
import { InscritosMinicursoModal } from "@/components/setec/InscritosMinicursoModal";
import { Travado } from "@/components/setec/Travado";
import { Paginacao } from "@/components/setec/Paginacao";
import { PalestraModal } from "@/components/setec/PalestraModal";
import { formatDia, formatHora, mensagemErro, type Minicurso } from "@/lib/setec";


/** Minicursos do painel (compartilhado entre a aba e o contador da aba). */
export function useMinicursos() {
  return useQuery({
    queryKey: ["minicursos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("minicursos" as any)
        .select("*")
        .order("data", { ascending: true })
        .order("hora_inicio", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Minicurso[];
    },
  });
}

/**
 * Conteúdo da aba "Minicursos" do painel: lista, cadastro/edição e lista de inscritos.
 * O painel separa os minicursos por dia (e rascunhos) e controla a paginação, igual às palestras.
 */
export function MinicursosSection({
  lista,
  pagina,
  porPagina,
  onPagina,
}: {
  /** Minicursos do dia (ou aba de rascunhos) selecionado. */
  lista: Minicurso[];
  pagina: number;
  porPagina: number;
  onPagina: (p: number) => void;
}) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Minicurso | null>(null);
  const [inscritosDe, setInscritosDe] = useState<Minicurso | null>(null);

  const minicursos = useMinicursos();

  // Só o id do minicurso de cada inscrição, para contar inscritos x vagas
  const inscricoes = useQuery({
    queryKey: ["minicurso_inscricoes", "contagem"],
    queryFn: async () => {
      const { data, error } = await supabase.from("minicurso_inscricoes" as any).select("minicurso_id");
      if (error) throw error;
      return (data ?? []) as unknown as { minicurso_id: string }[];
    },
  });

  const totalPorMinicurso = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const i of inscricoes.data ?? []) mapa.set(i.minicurso_id, (mapa.get(i.minicurso_id) ?? 0) + 1);
    return mapa;
  }, [inscricoes.data]);

  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = lista.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  const [dialogoConfirmar, confirmar] = useConfirmar();

  async function remover(m: Minicurso) {
    const total = totalPorMinicurso.get(m.id) ?? 0;
    const ok = await confirmar({
      tom: "perigo",
      titulo: "Remover minicurso",
      descricao: (
        <>
          <strong className="text-foreground">{m.titulo || "(Sem título)"}</strong> será apagado
          {total > 0 ? (
            <>
              {" "}junto com <strong className="text-foreground">{total}</strong>{" "}
              {total === 1 ? "inscrição" : "inscrições"}
            </>
          ) : null}
          . Esta ação não pode ser desfeita.
        </>
      ),
      confirmar: "Remover",
    });
    if (!ok) return;
    const { error } = await supabase.from("minicursos" as any).delete().eq("id", m.id);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    toast.success("Minicurso removido");
    queryClient.invalidateQueries({ queryKey: ["minicursos"] });
    queryClient.invalidateQueries({ queryKey: ["minicurso_inscricoes"] });
  }

  return (
    <>
        {minicursos.isError ? (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os minicursos. {mensagemErro(minicursos.error)}
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {visiveis.map((m) => {
              const inscritos = totalPorMinicurso.get(m.id) ?? 0;
              const esgotado = inscritos >= m.vagas;
              const nomes = (m.ministrantes ?? []).map((x) => x.nome).filter(Boolean).join(", ");
              return (
                <li key={m.id} className="group flex items-center gap-4 py-4">
                  <AvataresPessoas pessoas={m.ministrantes ?? []} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-base text-foreground">
                      <span className="truncate">{m.titulo || "(Sem título)"}</span>
                      {m.rascunho && (
                        <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                          Rascunho
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {nomes || "Ministrante não informado"}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold text-foreground">
                      {m.data ? formatDia(m.data) : "Sem data"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.hora_inicio && m.hora_fim
                        ? `${formatHora(m.hora_inicio)} - ${formatHora(m.hora_fim)}`
                        : "Sem horário"}
                    </p>
                  </div>
                  <button
                    onClick={() => setInscritosDe(m)}
                    title="Ver lista de inscritos"
                    className={`flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                      esgotado
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-500 hover:border-amber-500/70"
                        : "border-border/60 text-foreground hover:border-primary/60"
                    }`}
                  >
                    <ListChecks className="h-4 w-4" />
                    <span className="tabular-nums">
                      {inscritos}/{m.vagas}
                    </span>
                    <span className="hidden md:inline">{esgotado ? "esgotado" : "inscritos"}</span>
                  </button>
                  <Travado>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      aria-label="Editar minicurso"
                      onClick={() => {
                        setEditando(m);
                        setModalOpen(true);
                      }}
                      className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="Remover minicurso"
                      onClick={() => remover(m)}
                      className="rounded-full p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  </Travado>
                </li>
              );
            })}
          </ul>
        )}
        {minicursos.isLoading && <p className="py-4 text-sm text-muted-foreground">Carregando…</p>}
        {!minicursos.isError && !minicursos.isLoading && lista.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">Nenhum minicurso cadastrado.</p>
        )}
        <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} onChange={onPagina} />

        <Travado>
        <button
          onClick={() => {
            setEditando(null);
            setModalOpen(true);
          }}
          className="mt-5 flex h-16 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 text-[13px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          <CirclePlus className="h-5 w-5" />
          Adicionar minicurso
        </button>
        </Travado>

      <PalestraModal
        tipo="minicurso"
        open={modalOpen}
        onOpenChange={setModalOpen}
        minicurso={editando}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["minicursos"] })}
      />
      {dialogoConfirmar}
      <InscritosMinicursoModal
        minicurso={inscritosDe}
        onOpenChange={(v) => !v && setInscritosDe(null)}
      />
    </>
  );
}
