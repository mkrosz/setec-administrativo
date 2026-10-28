import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  FileText,
  Loader2,
  MailCheck,
  MailWarning,
  MailX,
  Pencil,
  RotateCw,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useConfirmar } from "@/components/setec/ConfirmDialog";
import { verificarDevolucoes } from "@/lib/devolucoes";
import { sugerirEmail } from "@/lib/email";
import { exportarInscritosMinicurso } from "@/lib/minicurso-pdf";
import {
  TURMA_NA,
  compararTurmas,
  formatDataHora,
  formatDia,
  formatHora,
  mensagemErro,
  type InscricaoMinicurso,
  type Minicurso,
  type Turma,
} from "@/lib/setec";

const label = "block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground";
const pill = "field-pill h-10 w-full px-4 text-sm";

type Dados = { nome: string; ra: string; email: string; turma: string };

/** Limpa e valida os dados digitados; devolve a mensagem de erro ou os dados prontos para salvar. */
function validar(
  d: Dados,
): { erro: string } | { nome: string; ra: string; email: string; turma: string } {
  const nome = d.nome.trim().replace(/\s+/g, " ");
  const ra = d.ra.replace(/\D/g, "");
  const email = d.email.trim().toLowerCase();
  if (nome.length < 3 || !nome.includes(" ")) return { erro: "Informe o nome completo" };
  if (!/^\d{5,20}$/.test(ra)) return { erro: "RA inválido. Use apenas números (5 a 20 dígitos)." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { erro: "Informe um e-mail válido" };
  if (!d.turma) return { erro: "Selecione a turma" };
  return { nome, ra, email, turma: d.turma };
}

type Props = {
  /** Minicurso aberto; null fecha o modal. */
  minicurso: Minicurso | null;
  onOpenChange: (v: boolean) => void;
};

/** Lista de inscritos de um minicurso: busca, inclusão manual, remoção e PDF. */
export function InscritosMinicursoModal({ minicurso, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  // Ao abrir a lista, confere as devoluções de e-mail que chegaram desde a última verificação
  useEffect(() => {
    if (minicurso) verificarDevolucoes(queryClient);
  }, [minicurso, queryClient]);
  const [busca, setBusca] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState({ nome: "", ra: "", email: "", turma: "" });

  const inscritos = useQuery({
    queryKey: ["minicurso_inscricoes", minicurso?.id],
    enabled: !!minicurso,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("minicurso_inscricoes" as any)
        .select("*")
        .eq("minicurso_id", minicurso!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InscricaoMinicurso[];
    },
    // Enquanto algum e-mail recente estiver "enviando", atualiza a lista para mostrar o resultado
    refetchInterval: (q) => ((q.state.data ?? []).some((i) => emailPendente(i)) ? 4000 : false),
  });

  const turmas = useQuery({
    queryKey: ["presenca_turmas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("presenca_turmas" as any).select("*");
      if (error) throw error;
      return ((data ?? []) as unknown as Turma[]).sort((a, b) => compararTurmas(a.nome, b.nome));
    },
  });

  const lista = inscritos.data ?? [];
  const termo = busca.trim().toLowerCase();
  const filtrados = useMemo(
    () =>
      lista.filter(
        (i) =>
          !termo ||
          i.nome_completo.toLowerCase().includes(termo) ||
          i.ra.includes(termo) ||
          i.email.toLowerCase().includes(termo),
      ),
    [lista, termo],
  );

  const vagas = minicurso?.vagas ?? 0;
  const ocupacao = vagas ? Math.min(100, Math.round((lista.length / vagas) * 100)) : 0;
  const esgotado = lista.length >= vagas;

  function atualizar() {
    queryClient.invalidateQueries({ queryKey: ["minicurso_inscricoes"] });
  }

  const [dialogoConfirmar, confirmar] = useConfirmar();
  // A sugestão só aparece depois que o campo de e-mail perde o foco (não enquanto digita)
  const [emailConferido, setEmailConferido] = useState(false);
  const sugestaoEmail = emailConferido ? sugerirEmail(novo.email) : null;

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!minicurso) return;
    const v = validar(novo);
    if ("erro" in v) {
      toast.error(v.erro);
      return;
    }
    const { nome, ra } = v;
    const email = await conferirEmail(v.email);
    if (email !== v.email) setNovo((n) => ({ ...n, email }));

    if (
      esgotado &&
      !(await confirmar({
        tom: "aviso",
        titulo: "Vagas esgotadas",
        descricao: (
          <>
            Este minicurso já tem <strong className="text-foreground">{lista.length}</strong> de{" "}
            <strong className="text-foreground">{vagas}</strong> vagas preenchidas. Adicionar{" "}
            <strong className="text-foreground">{nome}</strong> mesmo assim, além do limite?
          </>
        ),
        confirmar: "Adicionar mesmo assim",
      }))
    ) {
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.from("minicurso_inscricoes" as any).insert({
        minicurso_id: minicurso.id,
        nome_completo: nome,
        ra,
        email,
        turma: novo.turma,
        origem: "manual",
      } as any);
      if (error) {
        throw error.code === "23505"
          ? new Error("Este RA já está inscrito neste minicurso")
          : error;
      }
      toast.success("Inscrito adicionado", {
        description: `O e-mail de confirmação será enviado para ${email}`,
      });
      setNovo((n) => ({ nome: "", ra: "", email: "", turma: n.turma }));
      atualizar();
    } catch (err) {
      toast.error(mensagemErro(err, "Erro ao adicionar inscrito"));
    } finally {
      setSalvando(false);
    }
  }

  /** Domínio parecido com um comum (ex.: gmqil.com): pode existir e entregar o e-mail a um estranho. */
  async function conferirEmail(email: string) {
    const sugestao = sugerirEmail(email);
    if (!sugestao) return email;
    const corrigir = await confirmar({
      tom: "aviso",
      titulo: "Confira o e-mail",
      descricao: (
        <>
          <strong className="text-foreground">{email}</strong> parece ter um erro de digitação. Você
          quis dizer <strong className="text-foreground">{sugestao}</strong>?
        </>
      ),
      confirmar: `Usar ${sugestao.split("@")[1]}`,
      cancelar: "Manter como está",
    });
    return corrigir ? sugestao : email;
  }

  // Correção de uma inscrição (nome, RA, e-mail e turma); data de inscrição e origem não mudam
  const [editId, setEditId] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<Dados>({ nome: "", ra: "", email: "", turma: "" });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  function editar(i: InscricaoMinicurso) {
    setEditId(i.id);
    setEdicao({ nome: i.nome_completo, ra: i.ra, email: i.email, turma: i.turma });
  }

  async function salvarEdicao(i: InscricaoMinicurso) {
    const v = validar(edicao);
    if ("erro" in v) {
      toast.error(v.erro);
      return;
    }
    const email = await conferirEmail(v.email);
    setSalvandoEdicao(true);
    const { error } = await supabase
      .from("minicurso_inscricoes" as any)
      .update({ nome_completo: v.nome, ra: v.ra, email, turma: v.turma } as any)
      .eq("id", i.id);
    setSalvandoEdicao(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Este RA já está inscrito neste minicurso"
          : mensagemErro(error, "Erro ao salvar"),
      );
      return;
    }
    setEditId(null);
    atualizar();
    toast.success("Inscrição corrigida");
    // E-mail trocado: oferece mandar a confirmação para o endereço certo
    if (email !== i.email.toLowerCase()) {
      const enviar = await confirmar({
        tom: "neutro",
        titulo: "Enviar confirmação para o novo e-mail?",
        descricao: (
          <>
            O e-mail de confirmação da inscrição foi para{" "}
            <strong className="text-foreground">{i.email}</strong>. Enviar agora para{" "}
            <strong className="text-foreground">{email}</strong>?
          </>
        ),
        confirmar: "Enviar",
        cancelar: "Agora não",
      });
      if (enviar) await reenviar({ ...i, email });
    }
  }

  async function reenviar(i: InscricaoMinicurso) {
    const { error } = await supabase.rpc("reenviar_email_inscricao" as any, { _id: i.id } as any);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    toast.success(`Reenviando e-mail para ${i.email}`);
    atualizar();
  }

  async function remover(i: InscricaoMinicurso) {
    const ok = await confirmar({
      tom: "perigo",
      titulo: "Remover inscrição",
      descricao: (
        <>
          <strong className="text-foreground">{i.nome_completo}</strong> (RA {i.ra}) sai da lista de
          inscritos e a vaga fica livre de novo.
        </>
      ),
      confirmar: "Remover",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("minicurso_inscricoes" as any)
      .delete()
      .eq("id", i.id);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    toast.success("Inscrição removida");
    atualizar();
  }

  return (
    <Dialog.Root
      open={!!minicurso}
      onOpenChange={(v) => {
        if (!v) {
          setBusca("");
          setAdicionando(false);
          setEditId(null);
        }
        onOpenChange(v);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          // Esc com uma linha em edição cancela só a edição, sem fechar a lista
          onEscapeKeyDown={(e) => {
            if (editId) {
              e.preventDefault();
              setEditId(null);
            }
          }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[min(1000px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[26px] border border-border/60 bg-card shadow-[0_40px_90px_-20px_rgba(0,0,0,0.85)]"
        >
          <div className="flex items-start justify-between gap-4 px-5 sm:px-7 pb-4 pt-5">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-2xl font-bold text-foreground">
                Inscritos
              </Dialog.Title>
              <Dialog.Description className="mt-1 truncate text-sm text-muted-foreground">
                {minicurso?.titulo || "(Sem título)"}
                {minicurso?.data && ` • ${formatDia(minicurso.data)}`}
                {minicurso?.hora_inicio &&
                  ` • ${formatHora(minicurso.hora_inicio)}${minicurso.hora_fim ? ` - ${formatHora(minicurso.hora_fim)}` : ""}`}
                {minicurso?.local && ` • ${minicurso.local}`}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Ocupação das vagas */}
          <div className="px-7 pb-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-foreground">
                <strong className="font-display text-xl tabular-nums">{lista.length}</strong>
                <span className="text-muted-foreground"> de {vagas} vagas preenchidas</span>
              </span>
              <span className={esgotado ? "text-amber-500" : "text-muted-foreground"}>
                {esgotado ? "Esgotado" : `${Math.max(0, vagas - lista.length)} restantes`}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full transition-all ${esgotado ? "bg-amber-500" : "bg-primary"}`}
                style={{ width: `${ocupacao}%` }}
              />
            </div>
          </div>
          <div className="border-t border-border/60" />

          <div className="flex flex-wrap items-center gap-3 px-5 sm:px-7 py-4">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, RA ou e-mail…"
                aria-label="Buscar inscrito por nome, RA ou e-mail"
                className={`${pill} pl-10`}
              />
            </div>
            <button
              onClick={() => setAdicionando((v) => !v)}
              className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
                adicionando
                  ? "border-primary/70 bg-primary/10 text-foreground"
                  : "border-border/70 text-foreground hover:border-primary/60"
              }`}
            >
              <UserPlus className="h-4 w-4" />
              Adicionar inscrito
            </button>
            <button
              onClick={() => minicurso && exportarInscritosMinicurso(minicurso, lista)}
              disabled={lista.length === 0}
              className="flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              Baixar PDF
            </button>
          </div>

          {adicionando && (
            <form
              onSubmit={adicionar}
              className="mx-7 mb-4 grid gap-3 rounded-2xl border border-border/60 bg-field/40 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_1.3fr_0.9fr_auto]"
            >
              <div className="space-y-1.5">
                <span className={label}>Nome completo</span>
                <input
                  autoFocus
                  maxLength={160}
                  value={novo.nome}
                  onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                  className={pill}
                />
              </div>
              <div className="space-y-1.5">
                <span className={label}>RA</span>
                <input
                  inputMode="numeric"
                  maxLength={20}
                  value={novo.ra}
                  onChange={(e) => setNovo({ ...novo, ra: e.target.value.replace(/\D/g, "") })}
                  className={pill}
                />
              </div>
              <div className="space-y-1.5">
                <span className={label}>E-mail</span>
                <input
                  type="email"
                  maxLength={160}
                  value={novo.email}
                  onChange={(e) => {
                    setNovo({ ...novo, email: e.target.value });
                    setEmailConferido(false);
                  }}
                  onBlur={() => setEmailConferido(true)}
                  className={`${pill} ${sugestaoEmail ? "border-amber-500/60" : ""}`}
                />
                {sugestaoEmail && (
                  <button
                    type="button"
                    onClick={() => setNovo({ ...novo, email: sugestaoEmail })}
                    className="block px-2 text-left text-[11px] text-amber-500 hover:underline"
                  >
                    Você quis dizer {sugestaoEmail}?
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <span className={label}>Turma</span>
                <div className="relative">
                  <select
                    value={novo.turma}
                    onChange={(e) => setNovo({ ...novo, turma: e.target.value })}
                    className={`${pill} appearance-none pr-9`}
                  >
                    <option value="" disabled>
                      Selecione…
                    </option>
                    {(turmas.data ?? []).map((t) => (
                      <option key={t.id} value={t.nome}>
                        {t.nome}
                      </option>
                    ))}
                    <option value={TURMA_NA}>{TURMA_NA}</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <button
                type="submit"
                disabled={salvando}
                className="flex h-10 items-center justify-center gap-2 self-end rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
              >
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </button>
            </form>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-7 pb-6">
            {inscritos.isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : inscritos.isError ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {mensagemErro(inscritos.error, "Erro ao carregar inscritos")}
              </p>
            ) : filtrados.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {lista.length === 0 ? "Nenhuma inscrição ainda." : "Nenhum inscrito encontrado."}
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-card text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="py-2.5 pr-3 font-medium">#</th>
                    <th className="py-2.5 pr-3 font-medium">Nome</th>
                    <th className="py-2.5 pr-3 font-medium">RA</th>
                    <th className="hidden py-2.5 pr-3 font-medium md:table-cell">E-mail</th>
                    <th className="py-2.5 pr-3 font-medium">Turma</th>
                    <th className="hidden py-2.5 pr-3 font-medium lg:table-cell">Inscrito em</th>
                    <th className="w-20">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtrados.map((i) =>
                    editId === i.id ? (
                      <tr key={i.id} className="bg-primary/5">
                        <td colSpan={7} className="py-3">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              salvarEdicao(i);
                            }}
                            className="grid gap-3 rounded-2xl border border-primary/40 bg-field/40 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_1.3fr_0.9fr]"
                          >
                            <div className="space-y-1.5">
                              <span className={label}>Nome completo</span>
                              <input
                                autoFocus
                                maxLength={160}
                                value={edicao.nome}
                                onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })}
                                className={pill}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <span className={label}>RA</span>
                              <input
                                inputMode="numeric"
                                maxLength={20}
                                value={edicao.ra}
                                onChange={(e) =>
                                  setEdicao({ ...edicao, ra: e.target.value.replace(/\D/g, "") })
                                }
                                className={pill}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <span className={label}>E-mail</span>
                              <input
                                type="email"
                                maxLength={160}
                                value={edicao.email}
                                onChange={(e) => setEdicao({ ...edicao, email: e.target.value })}
                                className={pill}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <span className={label}>Turma</span>
                              <div className="relative">
                                <select
                                  value={edicao.turma}
                                  onChange={(e) => setEdicao({ ...edicao, turma: e.target.value })}
                                  className={`${pill} appearance-none pr-9`}
                                >
                                  {/* turma que não existe mais continua aparecendo para não perder o dado */}
                                  {edicao.turma &&
                                    edicao.turma !== TURMA_NA &&
                                    !(turmas.data ?? []).some((t) => t.nome === edicao.turma) && (
                                      <option value={edicao.turma}>{edicao.turma}</option>
                                    )}
                                  {(turmas.data ?? []).map((t) => (
                                    <option key={t.id} value={t.nome}>
                                      {t.nome}
                                    </option>
                                  ))}
                                  <option value={TURMA_NA}>{TURMA_NA}</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
                              <p className="text-xs text-muted-foreground">
                                Inscrito em {formatDataHora(i.created_at)}
                                {i.origem === "manual" ? " (manual)" : " pelo site"}. A data da
                                inscrição não muda.
                              </p>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setEditId(null)}
                                  className="h-10 px-3 text-sm font-medium text-foreground/90 hover:opacity-70"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="submit"
                                  disabled={salvandoEdicao}
                                  className="flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
                                >
                                  {salvandoEdicao && <Loader2 className="h-4 w-4 animate-spin" />}
                                  Salvar alterações
                                </button>
                              </div>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : (
                      <tr key={i.id} className="group">
                        <td className="py-3 pr-3 tabular-nums text-muted-foreground">
                          {lista.indexOf(i) + 1}
                        </td>
                        <td className="py-3 pr-3 text-foreground">
                          {i.nome_completo}
                          {i.origem === "manual" && (
                            <span className="ml-2 rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                              manual
                            </span>
                          )}
                          <span className="block text-xs text-muted-foreground md:hidden">
                            {i.email}
                          </span>
                        </td>
                        <td className="py-3 pr-3 tabular-nums text-foreground">{i.ra}</td>
                        <td className="hidden max-w-64 py-3 pr-3 text-muted-foreground md:table-cell">
                          <span className="flex items-center gap-2">
                            <StatusEmail inscricao={i} onReenviar={() => reenviar(i)} />
                            <span className="truncate" title={i.email}>
                              {i.email}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-foreground">{i.turma}</td>
                        <td className="hidden py-3 pr-3 tabular-nums text-muted-foreground lg:table-cell">
                          {formatDataHora(i.created_at)}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-0.5 acoes-hover">
                            <button
                              aria-label={`Editar ${i.nome_completo}`}
                              title="Corrigir nome, RA, e-mail ou turma"
                              onClick={() => editar(i)}
                              className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              aria-label={`Remover ${i.nome_completo}`}
                              onClick={() => remover(i)}
                              className="rounded-full p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )}
          </div>
          {dialogoConfirmar}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** E-mail ainda sem resultado, inscrito há menos de 2 minutos (o envio é assíncrono). */
function emailPendente(i: InscricaoMinicurso) {
  if (i.email_enviado_em === undefined) return false; // SQL do e-mail ainda não rodado
  return (
    !i.email_enviado_em && !i.email_erro && Date.now() - new Date(i.created_at).getTime() < 120_000
  );
}

/** Ícone do envio do e-mail de confirmação (enviado, com erro ou enviando) + reenvio. */
function StatusEmail({
  inscricao: i,
  onReenviar,
}: {
  inscricao: InscricaoMinicurso;
  onReenviar: () => void;
}) {
  if (i.email_enviado_em === undefined) return null;
  if (i.email_enviado_em) {
    return (
      <span title={`E-mail de confirmação enviado em ${formatDataHora(i.email_enviado_em)}`}>
        <MailCheck className="h-4 w-4 shrink-0 text-emerald-500" />
      </span>
    );
  }
  if (emailPendente(i)) {
    return (
      <span title="Enviando e-mail de confirmação...">
        <MailWarning className="h-4 w-4 shrink-0 animate-pulse text-muted-foreground" />
      </span>
    );
  }
  return (
    <button
      onClick={onReenviar}
      title={`E-mail não enviado${i.email_erro ? `: ${i.email_erro}` : ""}. Clique para reenviar.`}
      className="group/email flex shrink-0 items-center gap-1 rounded-full text-red-400 hover:text-red-300"
    >
      <MailX className="h-4 w-4" />
      <RotateCw className="hidden h-3 w-3 group-hover/email:block" />
    </button>
  );
}
