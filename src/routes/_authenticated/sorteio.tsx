import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Dices,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { SetecLogo } from "@/components/setec/SetecLogo";
import { IncluirNaRoleta } from "@/components/setec/IncluirNaRoleta";
import { ListaSorteados } from "@/components/setec/ListaSorteados";
import { RoletaSorteio } from "@/components/setec/RoletaSorteio";
import { useConfirmar } from "@/components/setec/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import {
  formatDia,
  formatHora,
  mensagemErro,
  nomesPalestrantes,
  type Palestra,
  type Presenca,
} from "@/lib/setec";
import {
  participanteManual,
  participantesDaChamada,
  rotacaoFinal,
  sortearIndice,
  type Participante,
  type ParticipanteManual,
} from "@/lib/sorteio";

type Busca = { palestra?: string };

export const Route = createFileRoute("/_authenticated/sorteio")({
  head: () => ({
    meta: [
      { title: "Sorteio | Painel SETEC" },
      {
        name: "description",
        content: "Roleta de sorteio entre os alunos presentes em cada palestra da SETEC.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): Busca =>
    typeof search["palestra"] === "string" ? { palestra: search["palestra"] } : {},
  // Usa a lista de presença: só master e administradores
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", context.user.id)
      .maybeSingle();
    if (data?.role !== "admin") throw redirect({ to: "/painel" });
  },
  component: SorteioPage,
});

/** O que fica guardado no navegador para cada palestra (sobrevive a recarregar a página). */
type EstadoSalvo = { sorteados: Participante[]; manuais: ParticipanteManual[] };

const VAZIO: EstadoSalvo = { sorteados: [], manuais: [] };

function chaveSalva(palestraId: string) {
  return `setec-sorteio-${palestraId}`;
}

function lerEstado(palestraId: string | null): EstadoSalvo {
  if (!palestraId || typeof window === "undefined") return VAZIO;
  try {
    const bruto = window.localStorage.getItem(chaveSalva(palestraId));
    if (!bruto) return VAZIO;
    const dados = JSON.parse(bruto) as Partial<EstadoSalvo>;
    return {
      sorteados: Array.isArray(dados.sorteados) ? dados.sorteados : [],
      manuais: Array.isArray(dados.manuais) ? dados.manuais : [],
    };
  } catch {
    return VAZIO;
  }
}

function salvarEstado(palestraId: string, estado: EstadoSalvo) {
  try {
    window.localStorage.setItem(chaveSalva(palestraId), JSON.stringify(estado));
  } catch {
    /* armazenamento bloqueado: o sorteio continua só na memória */
  }
}

function usaMovimentoReduzido() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function rotuloPalestra(p: Palestra) {
  const quando = [
    p.data ? formatDia(p.data) : null,
    p.hora_inicio ? formatHora(p.hora_inicio) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { quando: quando || "Sem data", titulo: p.titulo || "(Sem título)" };
}

const pillTrigger =
  "flex h-11 min-w-0 items-center gap-2 rounded-full border border-border/70 bg-field/60 px-4 text-sm text-foreground outline-none transition-colors hover:border-primary/60 data-[state=open]:border-primary/60";

function SorteioPage() {
  const { isLight, toggle } = useTheme();
  const [dialogoConfirmar, confirmar] = useConfirmar();
  const { palestra: palestraDaUrl } = Route.useSearch();
  const navigate = Route.useNavigate();

  const palestras = useQuery({
    queryKey: ["palestras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("palestras")
        .select("*")
        .order("data", { ascending: true })
        .order("hora_inicio", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Palestra[];
    },
  });

  const presencas = useQuery({
    queryKey: ["presencas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presencas" as any)
        .select("*")
        .order("registrado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Presenca[];
    },
  });

  const presencasPorPalestra = useMemo(() => {
    const map = new Map<string, Presenca[]>();
    for (const p of presencas.data ?? []) {
      if (!map.has(p.palestra_id)) map.set(p.palestra_id, []);
      map.get(p.palestra_id)!.push(p);
    }
    return map;
  }, [presencas.data]);

  const publicadas = useMemo(
    () => (palestras.data ?? []).filter((p) => !p.rascunho),
    [palestras.data],
  );
  const palestraId = palestraDaUrl ?? null;
  const palestra = publicadas.find((p) => p.id === palestraId) ?? null;

  function escolherPalestra(id: string) {
    navigate({ search: { palestra: id }, replace: true });
  }

  // ---- Estado do sorteio da palestra escolhida ----
  const [estado, setEstado] = useState<EstadoSalvo>(VAZIO);
  useEffect(() => {
    setEstado(lerEstado(palestraId));
    setVencedor(null);
  }, [palestraId]);

  const atualizar = useCallback(
    (fn: (e: EstadoSalvo) => EstadoSalvo) => {
      setEstado((atual) => {
        const novo = fn(atual);
        if (palestraId) salvarEstado(palestraId, novo);
        return novo;
      });
    },
    [palestraId],
  );

  const chamada = useMemo(
    () => (palestraId ? participantesDaChamada(presencasPorPalestra.get(palestraId) ?? []) : []),
    [palestraId, presencasPorPalestra],
  );
  const idsSorteados = useMemo(
    () => new Set(estado.sorteados.map((s) => s.id)),
    [estado.sorteados],
  );
  const naRoleta = useMemo(
    () =>
      [...chamada, ...estado.manuais.map(participanteManual)].filter(
        (p) => !idsSorteados.has(p.id),
      ),
    [chamada, estado.manuais, idsSorteados],
  );

  // ---- Giro ----
  const [rotacao, setRotacao] = useState(0);
  const [girando, setGirando] = useState(false);
  const [vencedor, setVencedor] = useState<Participante | null>(null);
  const alvo = useRef<Participante | null>(null);
  const duracaoMs = usaMovimentoReduzido() ? 900 : 6500;

  function girar() {
    if (girando || naRoleta.length === 0) return;
    const indice = sortearIndice(naRoleta.length);
    alvo.current = naRoleta[indice] ?? null;
    const voltas = 6 + Math.floor(Math.random() * 3);
    const desvio = Math.random() - 0.5;
    setVencedor(null);
    setGirando(true);
    setRotacao((r) => rotacaoFinal(r, indice, naRoleta.length, voltas, desvio));
  }

  const fimDoGiro = useCallback(() => {
    const sorteado = alvo.current;
    alvo.current = null;
    setGirando(false);
    if (!sorteado) return;
    setVencedor(sorteado);
    // Quem foi sorteado sai da roleta
    atualizar((e) => ({ ...e, sorteados: [...e.sorteados, sorteado] }));
  }, [atualizar]);

  function devolver(p: Participante) {
    atualizar((e) => ({ ...e, sorteados: e.sorteados.filter((s) => s.id !== p.id) }));
    if (vencedor?.id === p.id) setVencedor(null);
  }

  async function reiniciar() {
    const ok = await confirmar({
      titulo: "Reiniciar sorteio",
      descricao: "Todos os sorteados voltam para a roleta. Os nomes incluídos à mão continuam.",
      confirmar: "Reiniciar",
    });
    if (!ok) return;
    atualizar((e) => ({ ...e, sorteados: [] }));
    setVencedor(null);
  }

  // ---- Inclusão manual (não entra na lista de presença) ----
  function retirarManual(id: string) {
    atualizar((s) => ({
      ...s,
      manuais: s.manuais.filter((m) => m.id !== id),
      sorteados: s.sorteados.filter((m) => m.id !== id),
    }));
  }

  // ---- Tela cheia (para projetar o sorteio) ----
  const palco = useRef<HTMLElement>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  useEffect(() => {
    const aoMudar = () => setTelaCheia(document.fullscreenElement === palco.current);
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);
  function alternarTelaCheia() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void palco.current?.requestFullscreen?.().catch(() => toast.error("Tela cheia indisponível"));
  }

  const carregando = palestras.isLoading || presencas.isLoading;
  const erro = palestras.error ?? presencas.error;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-24 pt-8 sm:px-6 md:px-16">
      {dialogoConfirmar}
      <header className="relative mx-auto flex max-w-290 flex-wrap items-center justify-between gap-4">
        <SetecLogo />
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            aria-label="Alternar tema"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {isLight ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
          <Link
            to="/painel"
            className="flex h-10 items-center gap-2 rounded-full border border-border/70 px-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao painel
          </Link>
        </div>
      </header>

      <div className="relative mx-auto mt-14 max-w-290">
        <h1 className="title-gradient font-display text-[clamp(1.5rem,9vw,3.75rem)] font-black uppercase leading-[0.95] tracking-[-0.01em] lg:text-[68px]">
          Sorteio
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Escolha a chamada de uma palestra e gire a roleta. Quem é sorteado sai da roleta. Você
          também pode incluir um aluno só no sorteio, sem registrar presença.
        </p>

        {erro && (
          <p className="mt-8 rounded-2xl border border-destructive/50 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            Não foi possível carregar as palestras e presenças. {mensagemErro(erro)}
          </p>
        )}

        {/* Escolha da chamada */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`${pillTrigger} w-full sm:w-auto sm:max-w-xl`}
              disabled={carregando || publicadas.length === 0}
              aria-label="Escolher a chamada da palestra"
            >
              {carregando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4 text-primary-glow" />
              )}
              <span className="min-w-0 flex-1 truncate text-left">
                {palestra ? rotuloPalestra(palestra).titulo : "Escolha a chamada da palestra"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-96 w-[min(36rem,92vw)] overflow-y-auto"
            >
              <DropdownMenuLabel>Chamada da palestra</DropdownMenuLabel>
              {publicadas.map((p) => {
                const r = rotuloPalestra(p);
                const total = participantesDaChamada(presencasPorPalestra.get(p.id) ?? []).length;
                return (
                  <DropdownMenuItem key={p.id} onClick={() => escolherPalestra(p.id)}>
                    <Check
                      className={`mr-2 h-4 w-4 shrink-0 ${p.id === palestraId ? "" : "opacity-0"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] text-muted-foreground">{r.quando}</span>
                      <span className="block truncate">{r.titulo}</span>
                    </span>
                    <span className="ml-3 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {total} presente(s)
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          {palestra && (
            <span className="truncate text-xs text-muted-foreground">
              {nomesPalestrantes(palestra) || "Palestrante não informado"}
            </span>
          )}
        </div>

        {!palestra ? (
          <section className="panel-surface mt-6 flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Dices className="h-8 w-8 text-primary-glow" />
            <p className="text-sm text-muted-foreground">
              Escolha acima a chamada da palestra para montar a roleta.
            </p>
          </section>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            {/* Roleta */}
            <section
              ref={palco}
              className={`panel-surface relative flex flex-col items-center gap-6 overflow-hidden p-5 sm:p-8 ${
                telaCheia ? "justify-center rounded-none! bg-background" : ""
              }`}
            >
              <div className="amethyst-glow pointer-events-none absolute inset-0" />
              <div className="relative flex w-full items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">
                    {naRoleta.length}
                  </span>{" "}
                  na roleta · <span className="tabular-nums">{estado.sorteados.length}</span>{" "}
                  sorteado(s)
                </p>
                <button
                  onClick={alternarTelaCheia}
                  aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
                  title={telaCheia ? "Sair da tela cheia" : "Tela cheia (para projetar)"}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                >
                  {telaCheia ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div
                className={`relative w-full ${telaCheia ? "max-w-[min(80vh,900px)]" : "max-w-140"} pl-[6%]`}
              >
                <RoletaSorteio
                  participantes={naRoleta}
                  rotacao={rotacao}
                  girando={girando}
                  duracaoMs={duracaoMs}
                  onFimDoGiro={fimDoGiro}
                />
              </div>

              <div
                className="relative flex min-h-24 w-full flex-col items-center justify-center gap-1 text-center"
                aria-live="polite"
              >
                {vencedor ? (
                  <>
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-glow">
                      <Trophy className="h-4 w-4" />
                      Sorteado(a)
                    </span>
                    <span className="font-display text-2xl font-black sm:text-4xl">
                      {vencedor.nome}
                    </span>
                    {vencedor.detalhe && (
                      <span className="text-sm text-muted-foreground">{vencedor.detalhe}</span>
                    )}
                  </>
                ) : girando ? (
                  <span className="text-sm text-muted-foreground">Girando…</span>
                ) : naRoleta.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {chamada.length + estado.manuais.length === 0
                      ? "Ninguém na chamada desta palestra. Inclua alunos ao lado."
                      : "Todos já foram sorteados. Reinicie para sortear de novo."}
                  </span>
                ) : null}
              </div>

              <button
                onClick={girar}
                disabled={girando || naRoleta.length === 0}
                className="relative flex h-14 w-full max-w-xs items-center justify-center gap-3 rounded-full bg-primary px-8 font-display text-base font-bold uppercase tracking-[0.14em] text-primary-foreground shadow-[0_18px_40px_-12px] shadow-primary/60 transition-colors hover:bg-primary-glow disabled:opacity-50"
              >
                {girando ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Dices className="h-5 w-5" />
                )}
                {girando ? "Sorteando" : "Girar roleta"}
              </button>
            </section>

            {/* Lateral: inclusão manual e sorteados */}
            <aside className="flex flex-col gap-6">
              <IncluirNaRoleta
                manuais={estado.manuais}
                onIncluir={(novo) => atualizar((e) => ({ ...e, manuais: [...e.manuais, novo] }))}
                onRetirar={retirarManual}
              />
              <ListaSorteados
                sorteados={estado.sorteados}
                girando={girando}
                onDevolver={devolver}
                onReiniciar={reiniciar}
              />
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
