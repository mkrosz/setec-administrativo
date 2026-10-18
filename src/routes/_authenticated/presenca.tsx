import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  FileText,
  GraduationCap,
  Loader2,
  MapPin,
  Maximize2,
  Moon,
  QrCode,
  Search,
  Sun,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { SetecLogo } from "@/components/setec/SetecLogo";
import { PresencaModal } from "@/components/setec/PresencaModal";
import { useConfirmar } from "@/components/setec/ConfirmDialog";
import { TurmasModal } from "@/components/setec/TurmasModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForceDarkTheme, useTheme } from "@/hooks/use-theme";
import { resolverLocaisPendentes } from "@/lib/geo";
import { exportarListaPresenca } from "@/lib/presenca-pdf";
import {
  compararTurmas,
  nomesPalestrantes,
  coordenadasPresenca,
  formatDataHora,
  formatDia,
  formatHora,
  formatLocalPresenca,
  mapsUrl,
  mensagemErro,
  type EventConfig,
  type Palestra,
  type Presenca,
  type PresencaQrCode,
  type Turma,
} from "@/lib/setec";

export const Route = createFileRoute("/_authenticated/presenca")({
  head: () => ({
    meta: [
      { title: "Lista de Presença | Painel SETEC" },
      {
        name: "description",
        content:
          "Controle a presença dos alunos em cada palestra da Semana de Tecnologia com QR Code, inclusão manual e exportação em PDF.",
      },
      { property: "og:title", content: "Lista de Presença | Painel SETEC" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PresencaPage,
});

/** Relógio que atualiza a cada segundo (para as contagens regressivas). */
function useAgora() {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return agora;
}

/** Quantas palestras cabem na linha, conforme a largura da tela. */
function usePorPagina() {
  const calcular = () => {
    if (typeof window === "undefined") return 4;
    const w = window.innerWidth;
    return w < 640 ? 1 : w < 1024 ? 2 : w < 1280 ? 3 : 4;
  };
  const [n, setN] = useState(calcular);
  useEffect(() => {
    const onResize = () => setN(calcular());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return n;
}

function formatRestante(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function linkCheckin(token: string) {
  return `${window.location.origin}/checkin/${token}`;
}

function horario(p: Palestra) {
  return p.hora_inicio && p.hora_fim
    ? `${formatHora(p.hora_inicio)} - ${formatHora(p.hora_fim)}`
    : "Sem horário";
}

const pillTrigger =
  "flex h-10 min-w-0 items-center gap-2 rounded-full border border-border/70 bg-field/60 px-4 text-sm text-foreground outline-none transition-colors hover:border-primary/60 data-[state=open]:border-primary/60";
const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground";

function PresencaPage() {
  const queryClient = useQueryClient();
  const [dialogoConfirmar, confirmar] = useConfirmar();
  const { isLight, toggle } = useTheme();
  const agora = useAgora();

  const [diaAtivo, setDiaAtivo] = useState<string | null>(null);
  const [palestraAtiva, setPalestraAtiva] = useState<string | null>(null);
  const [pgPalestras, setPgPalestras] = useState(0);
  const porPagina = usePorPagina();
  const [busca, setBusca] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [turmasOpen, setTurmasOpen] = useState(false);
  const [projetar, setProjetar] = useState(false);
  const [ativando, setAtivando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const config = useQuery({
    queryKey: ["event_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as EventConfig | null;
    },
  });

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

  const turmas = useQuery({
    queryKey: ["presenca_turmas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("presenca_turmas" as any).select("*");
      if (error) throw error;
      return ((data ?? []) as unknown as Turma[]).sort((a, b) => compararTurmas(a.nome, b.nome));
    },
  });
  const nomesTurmas = useMemo(() => (turmas.data ?? []).map((t) => t.nome), [turmas.data]);

  // QR Codes não encerrados; o que está ativo é decidido pelo relógio.
  const qrcodes = useQuery({
    queryKey: ["presenca_qrcodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presenca_qrcodes" as any)
        .select("*")
        .eq("encerrado", false)
        .gt("expira_em", new Date(Date.now() - 60_000).toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PresencaQrCode[];
    },
  });

  const qrAtivoPorPalestra = useMemo(() => {
    const map = new Map<string, PresencaQrCode>();
    for (const q of qrcodes.data ?? []) {
      if (Date.parse(q.expira_em) > agora && !map.has(q.palestra_id)) map.set(q.palestra_id, q);
    }
    return map;
  }, [qrcodes.data, agora]);
  const algumQrAtivo = qrAtivoPorPalestra.size > 0;

  // Enquanto houver QR ativo, a lista atualiza sozinha.
  const presencas = useQuery({
    queryKey: ["presencas"],
    refetchInterval: algumQrAtivo ? 4000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presencas" as any)
        .select("*")
        .order("registrado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Presenca[];
    },
  });

  // Converte coordenadas em nome do local (e salva), uma consulta por vez.
  const resolvendo = useRef(false);
  useEffect(() => {
    const pendentes = (presencas.data ?? []).filter(
      (p) => !p.localizacao && p.latitude != null && p.longitude != null,
    );
    if (pendentes.length === 0 || resolvendo.current) return;
    resolvendo.current = true;
    resolverLocaisPendentes(pendentes)
      .then((atualizadas) => {
        if (atualizadas.size > 0) queryClient.invalidateQueries({ queryKey: ["presencas"] });
      })
      .finally(() => {
        resolvendo.current = false;
      });
  }, [presencas.data, queryClient]);

  const presencasPorPalestra = useMemo(() => {
    const map = new Map<string, Presenca[]>();
    for (const p of presencas.data ?? []) {
      if (!map.has(p.palestra_id)) map.set(p.palestra_id, []);
      map.get(p.palestra_id)!.push(p);
    }
    return map;
  }, [presencas.data]);

  // Agrupa as palestras publicadas por dia
  const dias = useMemo(() => {
    const map = new Map<string, Palestra[]>();
    for (const p of palestras.data ?? []) {
      if (p.rascunho) continue;
      const key = p.data ?? "sem-data";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a === "sem-data") return 1;
        if (b === "sem-data") return -1;
        return a.localeCompare(b);
      })
      .map(([key, items]) => ({
        key,
        label: key === "sem-data" ? "Sem data" : formatDia(key),
        items: [...items].sort((a, b) => (a.hora_inicio ?? "").localeCompare(b.hora_inicio ?? "")),
      }));
  }, [palestras.data]);

  const hoje = new Date().toLocaleDateString("en-CA");
  const diaSelecionado =
    dias.find((d) => d.key === diaAtivo) ?? dias.find((d) => d.key === hoje) ?? dias[0];
  const palestraSelecionada =
    diaSelecionado?.items.find((p) => p.id === palestraAtiva) ?? diaSelecionado?.items[0] ?? null;

  const itensDia = diaSelecionado?.items ?? [];
  const totalPgPalestras = Math.max(1, Math.ceil(itensDia.length / porPagina));
  const pgPalestrasAtual = Math.min(pgPalestras, totalPgPalestras - 1);
  const palestrasVisiveis = itensDia.slice(
    pgPalestrasAtual * porPagina,
    (pgPalestrasAtual + 1) * porPagina,
  );

  const listaPalestra = palestraSelecionada
    ? (presencasPorPalestra.get(palestraSelecionada.id) ?? [])
    : [];

  // Turmas presentes na lista + turmas cadastradas, para filtros e PDF
  const turmasDaLista = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const p of listaPalestra) contagem.set(p.ano_turma, (contagem.get(p.ano_turma) ?? 0) + 1);
    return Array.from(contagem.entries())
      .sort(([a], [b]) => compararTurmas(a, b))
      .map(([nome, total]) => ({ nome, total }));
  }, [listaPalestra]);

  const termo = busca.trim().toLowerCase();
  const listaFiltrada = listaPalestra.filter(
    (p) => !termo || p.nome_completo.toLowerCase().includes(termo) || p.ra.includes(termo),
  );

  const qrAtivo = palestraSelecionada ? qrAtivoPorPalestra.get(palestraSelecionada.id) : undefined;
  const restante = qrAtivo ? Date.parse(qrAtivo.expira_em) - agora : 0;

  function abrirProjecao() {
    setProjetar(true);
    // Tela cheia (como o F11); precisa partir do clique do usuário
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  function fecharProjecao() {
    setProjetar(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  // Fecha a projeção quando o QR expira
  useEffect(() => {
    if (projetar && !qrAtivo) fecharProjecao();
  }, [projetar, qrAtivo]);

  // Sair da tela cheia (Esc) também fecha a projeção
  useEffect(() => {
    if (!projetar) return;
    const onFullscreen = () => {
      if (!document.fullscreenElement) setProjetar(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fecharProjecao();
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("keydown", onKey);
    };
  }, [projetar]);

  async function ativarQr() {
    if (!palestraSelecionada) return;
    setAtivando(true);
    try {
      // Encerra QR Codes anteriores desta palestra antes de criar o novo
      const { error: encerrarErr } = await supabase
        .from("presenca_qrcodes" as any)
        .update({ encerrado: true } as any)
        .eq("palestra_id", palestraSelecionada.id)
        .eq("encerrado", false);
      if (encerrarErr) throw encerrarErr;
      const { error } = await supabase
        .from("presenca_qrcodes" as any)
        .insert({ palestra_id: palestraSelecionada.id } as any);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["presenca_qrcodes"] });
      toast.success("QR Code ativo por 10 minutos");
    } catch (err) {
      toast.error(mensagemErro(err, "Não foi possível ativar o QR Code"));
    } finally {
      setAtivando(false);
    }
  }

  async function encerrarQr() {
    if (!qrAtivo) return;
    const { error } = await supabase
      .from("presenca_qrcodes" as any)
      .update({ encerrado: true } as any)
      .eq("id", qrAtivo.id);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["presenca_qrcodes"] });
    toast.success("QR Code encerrado");
  }

  async function removerPresenca(p: Presenca) {
    const ok = await confirmar({
      tom: "perigo",
      titulo: "Remover presença",
      descricao: (
        <>
          <strong className="text-foreground">{p.nome_completo}</strong> (RA {p.ra}) sai da lista de presença desta
          palestra.
        </>
      ),
      confirmar: "Remover",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("presencas" as any)
      .delete()
      .eq("id", p.id);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["presencas"] });
    toast.success("Presença removida");
  }

  async function baixarPdf(turma?: string) {
    if (!palestraSelecionada) return;
    setGerandoPdf(true);
    try {
      const base = turma ? listaPalestra.filter((p) => p.ano_turma === turma) : listaPalestra;
      // Garante o nome do local antes de gerar o arquivo
      const nomes = await resolverLocaisPendentes(base);
      const lista = base.map((p) =>
        nomes.has(p.id) ? { ...p, localizacao: nomes.get(p.id)! } : p,
      );
      exportarListaPresenca(palestraSelecionada, lista, config.data ?? null, turma);
      if (nomes.size > 0) queryClient.invalidateQueries({ queryKey: ["presencas"] });
      toast.success("PDF gerado");
    } catch (err) {
      toast.error(mensagemErro(err, "Falha ao gerar o PDF"));
    } finally {
      setGerandoPdf(false);
    }
  }

  const carregando = palestras.isLoading || presencas.isLoading;
  const erroTabela = palestras.error ?? presencas.error ?? qrcodes.error ?? turmas.error;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-6 pb-24 pt-8 md:px-16">
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
        <h1 className="title-gradient font-display text-6xl font-black uppercase leading-[0.95] tracking-[-0.01em] md:text-[68px]">
          Lista de
          <br />
          Presença
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Escolha o dia e a palestra, ative o QR Code para os alunos confirmarem presença pelo
          celular (vale por 10 minutos), inclua alunos manualmente e baixe a lista em PDF.
        </p>

        {erroTabela && (
          <p className="mt-8 rounded-2xl border border-destructive/50 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            Não foi possível carregar os dados de presença. {mensagemErro(erroTabela)}
          </p>
        )}

        <h2 className="mt-16 flex items-center gap-3 font-display text-xl font-bold">
          <ClipboardCheck className="h-5 w-5 text-primary-glow" />
          Chamada
        </h2>
        <section className="panel-surface mt-5 p-7">
          {carregando && (
            <p className="flex items-center gap-2 pb-4 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando palestras e presenças…
            </p>
          )}
          {/* Seleção de dia e palestra */}
          <div className="flex items-center gap-3 border-b border-border/40 pb-5">
            <DropdownMenu>
              <DropdownMenuTrigger className={`${pillTrigger} shrink-0`} disabled={!dias.length}>
                <CalendarDays className="h-4 w-4 text-primary-glow" />
                {diaSelecionado?.label ?? "Dia"}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-44">
                <DropdownMenuLabel>Dia</DropdownMenuLabel>
                {dias.map((d) => (
                  <DropdownMenuItem
                    key={d.key}
                    onClick={() => {
                      setDiaAtivo(d.key);
                      setPalestraAtiva(null);
                      setPgPalestras(0);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${diaSelecionado?.key === d.key ? "" : "opacity-0"}`}
                    />
                    <span className="flex-1">{d.label}</span>
                    <span className="ml-3 text-xs text-muted-foreground">
                      {d.items.length} palestra(s)
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Palestras do dia, numa linha só (paginada se não couber) */}
            <ul className="flex min-w-0 flex-1 gap-2">
              {palestrasVisiveis.map((p) => {
                const selecionada = palestraSelecionada?.id === p.id;
                const total = presencasPorPalestra.get(p.id)?.length ?? 0;
                const ativo = qrAtivoPorPalestra.has(p.id);
                return (
                  <li key={p.id} className="min-w-0 flex-1">
                    <button
                      onClick={() => setPalestraAtiva(p.id)}
                      aria-pressed={selecionada}
                      title={[p.titulo, nomesPalestrantes(p)].filter(Boolean).join(" — ")}
                      className={`flex h-12 w-full items-center gap-2.5 rounded-2xl border pl-4 pr-2.5 text-left transition-colors ${
                        selecionada
                          ? "border-primary/70 bg-primary/10"
                          : "border-border/60 bg-field/40 hover:border-primary/40"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[10px] leading-tight tabular-nums text-muted-foreground">
                          {horario(p)}
                          {ativo && (
                            <span
                              title="QR ativo"
                              className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
                            />
                          )}
                        </span>
                        <span className="block truncate text-[13px] leading-snug text-foreground">
                          {p.titulo || "(Sem título)"}
                        </span>
                      </span>
                      <span
                        title={`${total} presença(s)`}
                        className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          total > 0
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-secondary/60 text-muted-foreground"
                        }`}
                      >
                        {total > 0 ? (
                          <UserCheck className="h-3 w-3" />
                        ) : (
                          <Users className="h-3 w-3" />
                        )}
                        {total}
                      </span>
                    </button>
                  </li>
                );
              })}
              {/* Mantém a largura dos cartões na última página */}
              {totalPgPalestras > 1 &&
                Array.from({ length: porPagina - palestrasVisiveis.length }, (_, i) => (
                  <li key={`vazio-${i}`} className="min-w-0 flex-1" aria-hidden />
                ))}
            </ul>

            {totalPgPalestras > 1 && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setPgPalestras(pgPalestrasAtual - 1)}
                  disabled={pgPalestrasAtual === 0}
                  aria-label="Palestras anteriores"
                  className={`${iconBtn} disabled:opacity-40`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-9 text-center text-[11px] tabular-nums text-muted-foreground">
                  {pgPalestrasAtual + 1}/{totalPgPalestras}
                </span>
                <button
                  onClick={() => setPgPalestras(pgPalestrasAtual + 1)}
                  disabled={pgPalestrasAtual >= totalPgPalestras - 1}
                  aria-label="Próximas palestras"
                  className={`${iconBtn} disabled:opacity-40`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {!carregando && !palestraSelecionada && (
            <p className="pt-5 text-sm text-muted-foreground">Nenhuma palestra publicada.</p>
          )}

          {palestraSelecionada && (
            <div className="flex flex-col gap-6 pt-6 lg:flex-row">
              {/* QR Code */}
              <div className="flex w-full shrink-0 flex-col items-center rounded-[28px] border border-dashed border-border/70 bg-field/40 p-6 lg:w-72">
                {qrAtivo ? (
                  <>
                    <QrImage
                      texto={linkCheckin(qrAtivo.token)}
                      tamanho={220}
                      className="rounded-2xl bg-white p-3"
                    />
                    <p className="mt-4 font-display text-3xl font-bold tabular-nums text-foreground">
                      {formatRestante(restante)}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      tempo restante
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button
                        onClick={abrirProjecao}
                        className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-glow"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        Projetar
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard
                            .writeText(linkCheckin(qrAtivo.token))
                            .then(() => toast.success("Link copiado"));
                        }}
                        aria-label="Copiar link do QR Code"
                        title="Copiar link"
                        className={iconBtn}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={encerrarQr}
                        aria-label="Encerrar QR Code"
                        title="Encerrar QR Code"
                        className={`${iconBtn} hover:border-destructive/60 hover:text-destructive`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="flex h-40 w-40 items-center justify-center rounded-2xl bg-secondary/60 text-muted-foreground">
                      <QrCode className="h-16 w-16 opacity-60" />
                    </span>
                    <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
                      Nenhum QR Code ativo para esta palestra.
                    </p>
                    <button
                      onClick={ativarQr}
                      disabled={ativando}
                      className="mt-4 flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
                    >
                      {ativando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4" />
                      )}
                      Ativar QR Code
                    </button>
                  </>
                )}
              </div>

              {/* Tabela */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-50 flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por nome ou RA"
                      aria-label="Buscar aluno por nome ou RA"
                      className="field-pill h-10 w-full pl-11 pr-4 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => setTurmasOpen(true)}
                    title="Gerenciar turmas"
                    className="flex h-10 items-center gap-2 rounded-full border border-border/70 px-4 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                  >
                    <GraduationCap className="h-4 w-4" />
                    Turmas
                  </button>
                  <button
                    onClick={() => setManualOpen(true)}
                    className="flex h-10 items-center gap-2 rounded-full border border-border/70 px-4 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                  >
                    <UserPlus className="h-4 w-4" />
                    Adicionar aluno
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={gerandoPdf}
                      className="flex h-10 items-center gap-2 rounded-full bg-primary/20 px-4 text-sm text-primary-glow outline-none transition-colors hover:bg-primary/30 disabled:opacity-60"
                    >
                      {gerandoPdf ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      Baixar PDF
                      <ChevronDown className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-52">
                      <DropdownMenuItem onClick={() => baixarPdf()}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span className="flex-1">Todos</span>
                        <span className="ml-3 text-xs text-muted-foreground">
                          {listaPalestra.length}
                        </span>
                      </DropdownMenuItem>
                      {turmasDaLista.length > 0 && <DropdownMenuSeparator />}
                      {turmasDaLista.map((t) => (
                        <DropdownMenuItem key={t.nome} onClick={() => baixarPdf(t.nome)}>
                          <GraduationCap className="mr-2 h-4 w-4" />
                          <span className="flex-1">{t.nome}</span>
                          <span className="ml-3 text-xs text-muted-foreground">{t.total}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                  {listaPalestra.length} presença(s) registrada(s)
                  {listaFiltrada.length !== listaPalestra.length &&
                    ` • ${listaFiltrada.length} exibida(s)`}
                  {qrAtivo && " • atualizando automaticamente"}
                </p>

                <div className="mt-3 max-h-130 overflow-auto rounded-2xl border border-border/60">
                  <table className="w-full min-w-170 text-left text-sm">
                    <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      <tr className="border-b border-border/60">
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Nome</th>
                        <th className="px-4 py-3 font-medium">RA</th>
                        <th className="px-4 py-3 font-medium">Turma</th>
                        <th className="px-4 py-3 font-medium">Horário</th>
                        <th className="px-4 py-3 font-medium">Local</th>
                        <th className="px-2 py-3">
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {listaFiltrada.map((p) => (
                        <tr key={p.id} className="group">
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {listaPalestra.indexOf(p) + 1}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {p.nome_completo}
                            {p.origem === "manual" && (
                              <span className="ml-2 rounded-full border border-border/70 px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                                manual
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-foreground/90">{p.ra}</td>
                          <td className="px-4 py-3 text-foreground/90">{p.ano_turma}</td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            {formatDataHora(p.registrado_em)}
                          </td>
                          <td className="max-w-72 px-4 py-3 text-xs text-muted-foreground">
                            <LocalCell p={p} />
                          </td>
                          <td className="px-2 py-3">
                            <button
                              aria-label="Remover presença"
                              onClick={() => removerPresenca(p)}
                              className="rounded-full p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {listaFiltrada.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-6 text-center text-sm text-muted-foreground"
                          >
                            {listaPalestra.length === 0
                              ? "Nenhuma presença registrada nesta palestra."
                              : "Nenhum aluno encontrado com esse filtro."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {dialogoConfirmar}
      <PresencaModal
        open={manualOpen}
        onOpenChange={setManualOpen}
        palestra={palestraSelecionada}
        turmas={nomesTurmas}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["presencas"] })}
      />
      <TurmasModal
        open={turmasOpen}
        onOpenChange={setTurmasOpen}
        turmas={turmas.data ?? []}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["presenca_turmas"] })}
      />

      {/* Projeção em tela cheia do QR Code */}
      {projetar && qrAtivo && palestraSelecionada && (
        <ProjecaoQr
          palestra={palestraSelecionada}
          link={linkCheckin(qrAtivo.token)}
          restante={formatRestante(restante)}
          onClose={fecharProjecao}
        />
      )}
    </main>
  );
}

/** QR Code para o telão: tudo cabe na tela, sem rolagem. */
function ProjecaoQr({
  palestra,
  link,
  restante,
  onClose,
}: {
  palestra: Palestra;
  link: string;
  restante: string;
  onClose: () => void;
}) {
  useForceDarkTheme();

  // Esconde a barra de rolagem da página enquanto projeta
  useEffect(() => {
    const html = document.documentElement;
    const anterior = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = anterior.html;
      document.body.style.overflow = anterior.body;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex h-dvh items-center justify-center gap-[6vw] overflow-hidden bg-[oklch(0.09_0.01_285)] px-[5vw] py-[5vh] text-white portrait:flex-col portrait:gap-[4vh]">
      <div className="amethyst-glow pointer-events-none absolute left-1/2 top-1/2 h-275 w-275 -translate-x-1/2 -translate-y-1/2" />
      <button
        onClick={onClose}
        aria-label="Fechar projeção"
        className="absolute right-6 top-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="relative flex min-w-0 max-w-[42vw] flex-col items-start text-left portrait:max-w-[90vw] portrait:items-center portrait:text-center">
        <SetecLogo className="scale-125 origin-left portrait:origin-center" />
        <p className="mt-[5vh] text-[clamp(0.75rem,1.2vw,1.1rem)] uppercase tracking-[0.3em] text-white/60">
          Confirme sua presença
        </p>
        <h2 className="mt-3 line-clamp-4 font-display text-[clamp(1.6rem,3.6vw,4.2rem)] font-black uppercase leading-[1.05]">
          {palestra.titulo}
        </h2>
        <p className="mt-3 text-[clamp(0.85rem,1.3vw,1.25rem)] text-white/70">
          {[horario(palestra), palestra.local, nomesPalestrantes(palestra)].filter(Boolean).join(" • ")}
        </p>
        <p className="mt-[5vh] font-display text-[clamp(2.5rem,6vw,6.5rem)] font-bold leading-none tabular-nums">
          {restante}
        </p>
        <p className="mt-2 text-[clamp(0.8rem,1.2vw,1.1rem)] text-white/60">
          Aponte a câmera do celular para o QR Code
        </p>
      </div>

      <QrImage
        texto={link}
        tamanho={720}
        className="relative size-[min(82dvh,44vw)] shrink-0 rounded-[2.5vh] bg-white p-[2.5vh] portrait:size-[min(50dvh,86vw)]"
      />
    </div>
  );
}

function LocalCell({ p }: { p: Presenca }) {
  const url = mapsUrl(p);
  const coords = coordenadasPresenca(p);
  if (!url) return <>{formatLocalPresenca(p)}</>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={coords ?? undefined}
      className="inline-flex items-start gap-1 text-primary-glow hover:underline"
    >
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {p.localizacao ?? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Identificando local…
          </span>
        )}
      </span>
    </a>
  );
}

function QrImage({
  texto,
  tamanho,
  className,
}: {
  texto: string;
  tamanho: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(texto, { width: tamanho, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => vivo && setSrc(url))
      .catch(() => vivo && setSrc(null));
    return () => {
      vivo = false;
    };
  }, [texto, tamanho]);

  if (!src) {
    return (
      <span
        className={`flex items-center justify-center ${className ?? ""}`}
        style={{ width: tamanho, height: tamanho, maxWidth: "100%" }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt="QR Code de presença"
      width={tamanho}
      height={tamanho}
      className={className}
    />
  );
}
