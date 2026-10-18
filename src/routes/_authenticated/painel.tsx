import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CirclePlus,
  ChevronDown,
  ClipboardCheck,
  Download,
  Eye,
  EyeOff,
  FileText,
  Upload,
  Handshake,
  Link2,
  LogOut,
  Mic,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sun,
  Moon,
  Trash2,
  Pencil,
  UserCheck,
  UserRound,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { SetecLogo, SetecMark } from "@/components/setec/SetecLogo";
import { StorageImage } from "@/components/setec/StorageImage";
import { PalestraModal } from "@/components/setec/PalestraModal";
import { PatrocinadorModal } from "@/components/setec/PatrocinadorModal";
import { removerAcesso } from "@/lib/access.functions";
import { Paginacao } from "@/components/setec/Paginacao";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportarJSON, exportarPDF, importarJSON, lerBackup, resumoBackup } from "@/lib/backup";
import {
  NIVEIS,
  GRUPOS_COMISSAO,
  porSemestre,
  semestresDoGrupo,
  type GrupoComissao,
  type MembroComissao,
  formatDia,
  formatHora,
  initials,
  mensagemErro,
  nomesPalestrantes,
  palestrantesDe,
  uploadFile,
  type EventConfig,
  type Palestra,
  type Patrocinador,
} from "@/lib/setec";
import { useTheme } from "@/hooks/use-theme";
import { ComissaoModal } from "@/components/setec/ComissaoModal";
import { DataEventoField } from "@/components/setec/DatasEventoFields";
import { ResetAnoModal } from "@/components/setec/ResetAnoModal";
import { StatusConsulta } from "@/components/setec/StatusConsulta";
import { useConfirmar } from "@/components/setec/ConfirmDialog";
import { verificarDevolucoes } from "@/lib/devolucoes";
import { AvataresPessoas } from "@/components/setec/AvataresPessoas";
import { MinicursosSection, useMinicursos } from "@/components/setec/MinicursosSection";

type AppRole = "admin" | "user";
type Profile = { id: string; email: string; role: AppRole; ativo: boolean; created_at: string };


export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel Administrativo | SETEC" },
      {
        name: "description",
        content:
          "Gerencie as configurações da edição, a grade de programação e os parceiros da Semana de Tecnologia em um único lugar.",
      },
      { property: "og:title", content: "Painel Administrativo | SETEC" },
      {
        property: "og:description",
        content: "Configurações da edição, palestras e apoiadores da Semana de Tecnologia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

const fieldLabel = "text-[10px] uppercase tracking-[0.16em] text-muted-foreground";

function Painel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logoRef = useRef<HTMLInputElement>(null);

  const [palestraOpen, setPalestraOpen] = useState(false);
  const [palestraEdit, setPalestraEdit] = useState<Palestra | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [dialogoConfirmar, confirmar] = useConfirmar();

  // Ao abrir o painel, confere se algum e-mail de confirmação foi devolvido (ex.: caixa inexistente)
  useEffect(() => {
    verificarDevolucoes(queryClient);
  }, [queryClient]);
  const [abaProgramacao, setAbaProgramacao] = useState<"palestras" | "minicursos">("palestras");
  const minicursosQuery = useMinicursos();
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [sponsorEdit, setSponsorEdit] = useState<Patrocinador | null>(null);
  const [nivelAtivo, setNivelAtivo] = useState<string>("MASTER");
  const [pgPalestras, setPgPalestras] = useState(1);
  const [pgApoiadores, setPgApoiadores] = useState(1);
  const [pgAcessos, setPgAcessos] = useState(1);
  const importRef = useRef<HTMLInputElement>(null);
  const [diaAtivo, setDiaAtivo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [comissaoOpen, setComissaoOpen] = useState(false);
  const [comissaoEdit, setComissaoEdit] = useState<MembroComissao | null>(null);
  const [grupoAtivo, setGrupoAtivo] = useState<GrupoComissao>("professor");
  const [pgComissao, setPgComissao] = useState(1);
  const { isLight, toggle } = useTheme();

  const config = useQuery({
    queryKey: ["event_config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_config").select("*").limit(1).maybeSingle();
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

  const patrocinadores = useQuery({
    queryKey: ["patrocinadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patrocinadores")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Patrocinador[];
    },
  });

  const meuPerfil = useQuery({
    queryKey: ["meu_perfil"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      return (data ?? null) as Profile | null;
    },
  });
  const isAdmin = meuPerfil.data?.role === "admin";

  const acessos = useQuery({
    queryKey: ["profiles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const comissao = useQuery({
  queryKey: ["comissao"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("comissao" as any)
      .select("*")
      .order("nome", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as MembroComissao[];
  },
});

  const removerConta = useServerFn(removerAcesso);

  async function atualizarAcesso(id: string, patch: { role?: AppRole; ativo?: boolean }) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["profiles"] });
    toast.success("Acesso atualizado");
  }

  async function excluirAcesso(id: string, email: string) {
    const ok = await confirmar({
      tom: "perigo",
      titulo: "Excluir conta de acesso",
      descricao: (
        <>
          A conta <strong className="text-foreground">{email}</strong> perde o acesso ao painel e é excluída
          definitivamente.
        </>
      ),
      confirmar: "Excluir conta",
    });
    if (!ok) return;
    try {
      await removerConta({ data: { userId: id } });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Conta removida");
    } catch (err) {
      toast.error(mensagemErro(err, "Falha ao remover a conta"));
    }
  }

  async function updateConfig(patch: Partial<EventConfig>) {

    if (!config.data) return;
    const { error } = await supabase.from("event_config").update(patch).eq("id", config.data.id);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["event_config"] });
  }

  async function onLogoChange(file: File | undefined) {
    if (!file) return;
    try {
      const path = await uploadFile(file, "evento");
      await updateConfig({ logo_url: path });
      toast.success("Logo do evento atualizada");
    } catch (err) {
      toast.error(mensagemErro(err, "Falha no upload"));
    }
  }

  async function removerPalestra(id: string) {
    const p = (palestras.data ?? []).find((x) => x.id === id);
    const ok = await confirmar({
      tom: "perigo",
      titulo: "Remover palestra",
      descricao: (
        <>
          <strong className="text-foreground">{p?.titulo || "Esta palestra"}</strong> será apagada junto com a lista de
          presença e os QR Codes dela. Esta ação não pode ser desfeita.
        </>
      ),
      confirmar: "Remover",
    });
    if (!ok) return;
    const { error } = await supabase.from("palestras").delete().eq("id", id);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    toast.success("Palestra removida");
    queryClient.invalidateQueries({ queryKey: ["palestras"] });
  }

  async function removerPatrocinador(id: string) {
    const a = (patrocinadores.data ?? []).find((x) => x.id === id);
    const ok = await confirmar({
      tom: "perigo",
      titulo: "Remover apoiador",
      descricao: (
        <>
          <strong className="text-foreground">{a?.nome_empresa || "Este apoiador"}</strong> sai da lista de apoiadores e
          da faixa de parceiros do site.
        </>
      ),
      confirmar: "Remover",
    });
    if (!ok) return;
    const { error } = await supabase.from("patrocinadores").delete().eq("id", id);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    toast.success("Apoiador removido");
    queryClient.invalidateQueries({ queryKey: ["patrocinadores"] });
  }

  async function removerMembro(id: string) {
    const m = (comissao.data ?? []).find((x) => x.id === id);
    const ok = await confirmar({
      tom: "perigo",
      titulo: "Remover membro",
      descricao: (
        <>
          <strong className="text-foreground">{m?.nome || "Este membro"}</strong> sai da comissão organizadora e da página
          Comissão do site.
        </>
      ),
      confirmar: "Remover",
    });
    if (!ok) return;
    const { error } = await supabase.from("comissao" as any).delete().eq("id", id);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    toast.success("Membro removido");
    queryClient.invalidateQueries({ queryKey: ["comissao"] });
  }

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const PAGE = 3;
  // Apoiadores: cabe uma linha inteira de logos antes de paginar
  const apoiadoresRef = useRef<HTMLDivElement>(null);
  const porPaginaApoiadores = useCabemNaLinha(apoiadoresRef, LOGO_LARGURA, LOGO_GAP);

  // Agrupa as palestras por data; palestras sem data ficam numa aba no final
  const diasPalestras = useMemo(() => {
  const map = new Map<string, Palestra[]>();
  const rascunhos: Palestra[] = [];

  for (const p of palestras.data ?? []) {
    if (p.rascunho) {
      rascunhos.push(p);
      continue;
    }
    const key = p.data ?? "sem-data";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }

  const dias = Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === "sem-data") return 1;
      if (b === "sem-data") return -1;
      return a.localeCompare(b);
    })
    .map(([key, items]) => ({
      key,
      label: key === "sem-data" ? "Sem data" : formatDia(key),
      items: [...items].sort(
        (a, b) =>
          (a.hora_inicio ?? "").localeCompare(b.hora_inicio ?? "") ||
          (a.hora_fim ?? "").localeCompare(b.hora_fim ?? ""),
      ),
    }));

  if (rascunhos.length > 0) {
    dias.push({
      key: "rascunhos",
      label: "Rascunhos",
      items: rascunhos.sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    });
  }

  return dias;
}, [palestras.data]);

  // Se a aba ativa não existir mais (ou ainda não foi escolhida), usa a primeira
  const diaSelecionado = diasPalestras.find((d) => d.key === diaAtivo) ?? diasPalestras[0];
  const listaPalestras = diaSelecionado?.items ?? [];
  const totalPgPalestras = Math.max(1, Math.ceil(listaPalestras.length / PAGE));
  const pgPalestrasAtual = Math.min(pgPalestras, totalPgPalestras);
  const palestrasPagina = listaPalestras.slice(
    (pgPalestrasAtual - 1) * PAGE,
    pgPalestrasAtual * PAGE,
  );

  const doNivel = useMemo(
    () => (patrocinadores.data ?? []).filter((p) => p.nivel === nivelAtivo),
    [patrocinadores.data, nivelAtivo],
  );
  // Comissão: 12 por página; nos cursos semestrais a ordem é por semestre antes de paginar
  const POR_PAGINA_COMISSAO = 12;
  const todosDoGrupo = (comissao.data ?? []).filter((m) => m.grupo === grupoAtivo);
  const ordenadosDoGrupo = semestresDoGrupo(grupoAtivo)
    ? porSemestre(todosDoGrupo).flatMap((b) => b.membros)
    : todosDoGrupo;
  const totalPgComissao = Math.max(1, Math.ceil(ordenadosDoGrupo.length / POR_PAGINA_COMISSAO));
  const pgComissaoAtual = Math.min(pgComissao, totalPgComissao);
  const membrosDoGrupo = ordenadosDoGrupo.slice(
    (pgComissaoAtual - 1) * POR_PAGINA_COMISSAO,
    pgComissaoAtual * POR_PAGINA_COMISSAO,
  );
  const totalPgApoiadores = Math.max(1, Math.ceil(doNivel.length / porPaginaApoiadores));
  const pgApoiadoresAtual = Math.min(pgApoiadores, totalPgApoiadores);
  const apoiadoresPagina = doNivel.slice(
    (pgApoiadoresAtual - 1) * porPaginaApoiadores,
    pgApoiadoresAtual * porPaginaApoiadores,
  );

  const listaAcessos = acessos.data ?? [];
  const totalPgAcessos = Math.max(1, Math.ceil(listaAcessos.length / PAGE));
  const acessosPagina = listaAcessos.slice((pgAcessos - 1) * PAGE, pgAcessos * PAGE);

  const eventoAtivo = config.data?.evento_ativo ?? true;

  async function comEspera(fn: () => Promise<void>, sucesso: string) {
    setOcupado(true);
    try {
      await fn();
      toast.success(sucesso);
    } catch (err) {
      toast.error(mensagemErro(err, "Ocorreu um erro"));
    } finally {
      setOcupado(false);
    }
  }

  async function onImportar(file: File | undefined) {
    if (!file) return;
    let r: ReturnType<typeof resumoBackup>;
    try {
      r = resumoBackup(await lerBackup(file));
    } catch (err) {
      toast.error(mensagemErro(err, "Não foi possível ler o arquivo"));
      return;
    }
    const itens = [
      [r.palestras, "palestras"],
      [r.presencas, "presenças"],
      [r.minicursos, "minicursos"],
      [r.inscricoes, "inscrições"],
      [r.apoiadores, "apoiadores"],
      [r.comissao, "membros da comissão"],
    ].filter(([n]) => (n as number) > 0) as [number, string][];
    const ok = await confirmar({
      tom: "aviso",
      titulo: "Importar backup",
      descricao: (
        <>
          <span className="block">
            Arquivo <strong className="text-foreground">{file.name}</strong>
            {r.exportadoEm ? `, gerado em ${r.exportadoEm}` : ""}.
          </span>
          <span className="mt-2 block">
            Será restaurado:{" "}
            {itens.length ? itens.map(([n, nome]) => `${n} ${nome}`).join(", ") : "nenhum registro"}
            {r.evento ? ", e as informações do evento" : ""}.
          </span>
          <span className="mt-2 block">
            Registros com o mesmo código são <strong className="text-foreground">substituídos</strong> pelos do
            arquivo; os demais continuam como estão.
          </span>
        </>
      ),
      confirmar: "Importar",
    });
    if (!ok) return;
    await comEspera(async () => {
      await importarJSON(file);
      queryClient.invalidateQueries();
    }, "Dados importados");
  }

  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-background px-6 pb-24 pt-8 md:px-16">
        <header className="relative mx-auto flex max-w-290 flex-wrap items-center justify-between gap-4">
          <SetecLogo />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setResetOpen(true)}
              className="flex h-10 items-center gap-2 rounded-full border border-destructive/60 px-5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <RotateCcw className="h-4 w-4" />
              Resetar dados do ano
            </button>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={ocupado}
                    aria-label="Exportar dados"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-42.5">
                  <DropdownMenuItem onClick={() => comEspera(exportarPDF, "PDF gerado")}>
                    <FileText className="mr-2 h-4 w-4" />
                    Apenas PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => comEspera(exportarJSON, "JSON exportado")}>
                    <Download className="mr-2 h-4 w-4" />
                    Apenas JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      comEspera(async () => {
                        await exportarPDF();
                        await exportarJSON();
                      }, "Exportação concluída")
                    }
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    PDF + JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={() => importRef.current?.click()}
                disabled={ocupado}
                aria-label="Importar dados"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  onImportar(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => updateConfig({ evento_ativo: !eventoAtivo })}
                className={`flex h-10 items-center gap-2 rounded-full px-5 text-sm transition-colors ${
                  eventoAtivo
                    ? "bg-primary/20 text-primary-glow hover:bg-primary/30"
                    : "border border-border/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {eventoAtivo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {eventoAtivo ? "Evento ativo" : "Evento oculto"}
              </button>
            </div>
            <Link
              to="/presenca"
              className="flex h-10 items-center gap-2 rounded-full border border-border/70 px-5 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            >
              <ClipboardCheck className="h-4 w-4" />
              Presença
            </Link>
            <span className="h-7 w-px bg-border" />
            <button
              onClick={toggle}
              aria-label="Alternar tema"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {isLight ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <Link
              to="/perfil"
              aria-label="Meu perfil"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            >
              <UserRound className="h-4 w-4" />
            </Link>
            <button
              onClick={sair}
              aria-label="Sair do painel"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/25 text-primary-glow transition-colors hover:bg-primary/40"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="relative mx-auto mt-14 max-w-290">
          <h1 className="title-gradient font-display text-6xl font-black uppercase leading-[0.95] tracking-[-0.01em] md:text-[68px]">
            Painel
            <br />
            Administrativo
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Gerencie as configurações da edição, grade de programação e parceiros do evento em um
            único lugar.
          </p>

          {/* Informações do Evento */}
          <h2 className="mt-16 flex items-center gap-3 font-display text-xl font-bold">
            <Settings className="h-5 w-5 text-primary-glow" />
            Informações do Evento
          </h2>
          <section className="panel-surface mt-5 p-7">
            <StatusConsulta consulta={config} nome="as informações do evento" />
            <span className="text-xs text-muted-foreground">Logo do Evento</span>
            <div className="mt-3 flex flex-col gap-5 lg:flex-row">
              <button
                onClick={() => logoRef.current?.click()}
                className="flex h-42.5 w-full max-w-65 items-center justify-center rounded-[28px] border border-dashed border-border/70 bg-field/40 text-muted-foreground transition-colors hover:border-primary/60"
              >
                <StorageImage
                  path={config.data?.logo_url ?? null}
                  alt="Logo do evento"
                  className="max-h-30 max-w-50"
                  fallback={
                    <span className="flex items-center gap-3">
                      <SetecMark className="h-10 w-14 opacity-70" />
                      <span className="text-left font-display leading-tight">
                        <span className="block text-[9px] tracking-[0.22em]">SEMANA DE</span>
                        <span className="block text-base font-extrabold">TECNOLOGIA</span>
                        <span className="block text-[9px] tracking-[0.2em]">
                          {config.data?.edicao}
                        </span>
                      </span>
                    </span>
                  }
                />
              </button>
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onLogoChange(e.target.files?.[0])}
              />

              <div className="grid flex-1 gap-4 sm:grid-cols-3">
                <ConfigField
                  label="Edição"
                  value={config.data?.edicao ?? ""}
                  onCommit={(v) => updateConfig({ edicao: v })}
                />
                <div className="sm:col-span-2">
                  <DataEventoField
                    datas={config.data?.datas ?? ""}
                    ano={config.data?.ano ?? ""}
                    onChange={(datas, ano) => updateConfig({ datas, ano })}
                  />
                </div>
                <ConfigField
                  className="sm:col-span-2"
                  icon
                  label="Sympla URL (Ingressos)"
                  value={config.data?.sympla_url ?? ""}
                  onCommit={(v) => updateConfig({ sympla_url: v })}
                />
                <ConfigField
                  icon
                  label="Instagram URL"
                  value={config.data?.instagram_url ?? ""}
                  onCommit={(v) => updateConfig({ instagram_url: v })}
                />
              </div>
            </div>
          </section>

          {/* Programação: palestras e minicursos */}
          <h2 className="mt-16 flex items-center gap-3 font-display text-xl font-bold">
            <Mic className="h-5 w-5 text-primary-glow" />
            Gerenciar Programação
          </h2>
          <section className="panel-surface mt-5 p-7">
            {/* Linha de abas: dias (palestras) à esquerda, palestras/minicursos à direita */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-b border-border/40 pb-4">
              <div className="flex flex-wrap gap-8">
                {abaProgramacao === "palestras" ? (
                  diasPalestras.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => {
                        setDiaAtivo(d.key);
                        setPgPalestras(1);
                      }}
                      className={`text-[11px] uppercase tracking-[0.18em] transition-colors ${
                        diaSelecionado?.key === d.key
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground/80"
                      }`}
                    >
                      {d.label}
                      <span className="ml-2 text-[10px] opacity-60">({d.items.length})</span>
                    </button>
                  ))
                ) : (
                  <span className="text-[11px] uppercase tracking-[0.18em] text-foreground">
                    Todos os minicursos
                  </span>
                )}
              </div>
              {/* Seletor em pílula: fundo de campo, aba ativa com roxo translúcido */}
              <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-field/60 p-1" role="tablist">
                {(
                  [
                    { valor: "palestras", rotulo: "Palestras", total: (palestras.data ?? []).length },
                    { valor: "minicursos", rotulo: "Minicursos", total: (minicursosQuery.data ?? []).length },
                  ] as const
                ).map((aba) => {
                  const ativa = abaProgramacao === aba.valor;
                  return (
                    <button
                      key={aba.valor}
                      role="tab"
                      aria-selected={ativa}
                      onClick={() => setAbaProgramacao(aba.valor)}
                      className={`flex h-8 items-center gap-2 rounded-full px-4 text-xs font-medium transition-all ${
                        ativa
                          ? "bg-primary/20 text-foreground ring-1 ring-primary/30"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full transition-colors ${
                          ativa ? "bg-primary-glow" : "bg-muted-foreground/40"
                        }`}
                      />
                      {aba.rotulo}
                      <span className={`tabular-nums ${ativa ? "text-primary-glow" : "opacity-60"}`}>{aba.total}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {abaProgramacao === "minicursos" ? (
              <MinicursosSection />
            ) : (
            <>
            <StatusConsulta consulta={palestras} nome="as palestras" />
            <ul className="divide-y divide-border/40">
              {palestrasPagina.map((p) => (
                <li key={p.id} className="group flex items-center gap-4 py-4">
                  <AvataresPessoas pessoas={palestrantesDe(p)} />
                                    <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-base text-foreground">
                      <span className="truncate">{p.titulo || "(Sem título)"}</span>
                      {p.rascunho && (
                        <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                          Rascunho
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {nomesPalestrantes(p) || "Palestrante não informado"}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold text-foreground">
                      {p.data ? formatDia(p.data) : "Sem data"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.hora_inicio && p.hora_fim
                        ? `${formatHora(p.hora_inicio)} - ${formatHora(p.hora_fim)}`
                        : "Sem horário"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      aria-label="Editar palestra"
                      onClick={() => {
                        setPalestraEdit(p);
                        setPalestraOpen(true);
                      }}
                      className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="Remover palestra"
                      onClick={() => removerPalestra(p.id)}
                      className="rounded-full p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {palestras.isSuccess && diasPalestras.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">Nenhuma palestra cadastrada.</p>
            )}
            {totalPgPalestras > 1 && (
            <Paginacao
              pagina={pgPalestrasAtual}
              totalPaginas={totalPgPalestras}
              onChange={setPgPalestras}
            />
          )}
          
            <button
              onClick={() => {
                setPalestraEdit(null);
                setPalestraOpen(true);
              }}
              className="mt-5 flex h-16 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 text-[13px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            >
              <CirclePlus className="h-5 w-5" />
              Adicionar palestra
            </button>
            </>
            )}
          </section>

          {/* Apoiadores */}
          <h2 className="mt-16 flex items-center gap-3 font-display text-xl font-bold">
            <Handshake className="h-5 w-5 text-primary-glow" />
            Apoiadores
          </h2>
          <section className="panel-surface mt-5 p-7">
            <div className="flex flex-wrap gap-8 border-b border-border/40 pb-4">
              {NIVEIS.map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setNivelAtivo(n);
                    setPgApoiadores(1);
                  }}
                  className={`text-[11px] tracking-[0.18em] transition-colors ${
                    nivelAtivo === n
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <StatusConsulta consulta={patrocinadores} nome="os apoiadores" />
            <div ref={apoiadoresRef} className="mt-6 flex flex-wrap gap-4">
              {apoiadoresPagina.map((s) => (
                <div
                  key={s.id}
                  className="group relative h-23.75 w-48.75 overflow-hidden rounded-lg border border-border/60 bg-field"
                >
                  <StorageImage
                    path={s.logo_url}
                    alt={s.nome_empresa}
                    className="h-full w-full object-contain p-3"
                    fallback={
                      <span className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                        {s.nome_empresa}
                      </span>
                    }
                  />
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-linear-to-t from-black/80 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      aria-label="Editar apoiador"
                      onClick={() => {
                        setSponsorEdit(s);
                        setSponsorOpen(true);
                      }}
                      className="rounded-full p-1.5 text-white/80 hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      aria-label="Remover apoiador"
                      onClick={() => removerPatrocinador(s.id)}
                      className="rounded-full p-1.5 text-white/80 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {patrocinadores.isSuccess && doNivel.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum apoiador cadastrado neste nível.
                </p>
              )}
            </div>
            <Paginacao pagina={pgApoiadoresAtual} totalPaginas={totalPgApoiadores} onChange={setPgApoiadores} />

            <button
              onClick={() => {
                setSponsorEdit(null);
                setSponsorOpen(true);
              }}
              className="mt-6 flex h-16 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 text-[13px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            >
              <CirclePlus className="h-5 w-5" />
              Adicionar apoiador
            </button>
          </section>

         {/* Comissão */}
          <h2 className="mt-16 flex items-center gap-3 font-display text-xl font-bold">
            <Users className="h-5 w-5 text-primary-glow" />
            Comissão
          </h2>
          <section className="panel-surface mt-5 p-7">
            <div className="flex flex-wrap gap-8 border-b border-border/40 pb-4">
              {GRUPOS_COMISSAO.map((g) => {
                const total = (comissao.data ?? []).filter((m) => m.grupo === g.value).length;
                return (
                  <button
                    key={g.value}
                    onClick={() => {
                      setGrupoAtivo(g.value);
                      setPgComissao(1);
                    }}
                    className={`text-[11px] uppercase tracking-[0.18em] transition-colors ${
                      grupoAtivo === g.value
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground/80"
                    }`}
                  >
                    {g.label}
                    <span className="ml-2 text-[10px] opacity-60">({total})</span>
                  </button>
                );
              })}
            </div>

            <StatusConsulta consulta={comissao} nome="a comissão" />
            {membrosDoGrupo.length === 0 ? (
              comissao.isSuccess ? (
                <p className="mt-6 text-sm text-muted-foreground">Nenhum membro cadastrado neste grupo.</p>
              ) : null
            ) : (
              <div className="mt-6 space-y-6">
                {(semestresDoGrupo(grupoAtivo)
                  ? porSemestre(membrosDoGrupo)
                  : [{ semestre: 0, membros: membrosDoGrupo }]
                ).map((bloco) => (
                  <div key={bloco.semestre}>
                    {bloco.semestre > 0 && (
                      <p className="mb-3 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        <span className="text-foreground">{bloco.semestre}º semestre</span>
                        <span className="opacity-60">({bloco.membros.length})</span>
                        <span className="h-px flex-1 bg-border/40" />
                      </p>
                    )}
                    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {bloco.membros.map((m) => (
                        <li
                          key={m.id}
                          className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-field/40 px-4 py-3 transition-colors hover:border-primary/40"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary-glow">
                            {initials(m.nome)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground" title={m.nome}>
                              {m.nome}
                            </p>
                            <p
                              className="truncate text-xs text-muted-foreground"
                              title={m.email ?? undefined}
                            >
                              {m.email || "Sem e-mail"}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <button
                              aria-label="Editar membro"
                              onClick={() => {
                                setComissaoEdit(m);
                                setComissaoOpen(true);
                              }}
                              className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              aria-label="Remover membro"
                              onClick={() => removerMembro(m.id)}
                              className="rounded-full p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <Paginacao pagina={pgComissaoAtual} totalPaginas={totalPgComissao} onChange={setPgComissao} />

            <button
              onClick={() => {
                setComissaoEdit(null);
                setComissaoOpen(true);
              }}
              className="mt-6 flex h-16 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 text-[13px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            >
              <CirclePlus className="h-5 w-5" />
              Adicionar membro
            </button>
          </section>

          {/* Controle de Acessos — apenas administradores */}
          {isAdmin && (
            <>
              <h2 className="mt-16 flex items-center gap-3 font-display text-xl font-bold">
                <ShieldCheck className="h-5 w-5 text-primary-glow" />
                Controle de Acessos
              </h2>
              <section className="panel-surface mt-5 p-7">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Libere ou bloqueie o acesso ao painel e defina o tipo de cada conta. Usuários
                  comuns gerenciam o evento, mas não podem liberar acessos de outras pessoas.
                </p>
                <StatusConsulta consulta={acessos} nome="os acessos" />
                <ul className="mt-5 divide-y divide-border/40">
                  {acessosPagina.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-4 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] text-foreground">{c.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.ativo ? "Acesso liberado" : "Aguardando liberação"}
                          {c.id === meuPerfil.data?.id && " • você"}
                        </p>
                      </div>
                      <div className="relative shrink-0">
                        <select
                          aria-label={`Papel de ${c.email}`}
                          value={c.role}
                          disabled={c.id === meuPerfil.data?.id}
                          onChange={(e) => atualizarAcesso(c.id, { role: e.target.value as AppRole })}
                          className="field-pill h-10 appearance-none py-0 pl-4 pr-10 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="admin">Administrador</option>
                          <option value="user">Usuário comum</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                      <button
                        onClick={() => atualizarAcesso(c.id, { ativo: !c.ativo })}
                        disabled={c.id === meuPerfil.data?.id}
                        className={`flex h-10 items-center gap-2 rounded-full px-5 text-sm transition-colors disabled:opacity-50 ${
                          c.ativo
                            ? "border border-border/70 text-muted-foreground hover:text-foreground"
                            : "bg-primary text-primary-foreground hover:bg-primary-glow"
                        }`}
                      >
                        {c.ativo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        {c.ativo ? "Desativar" : "Liberar"}
                      </button>
                      <button
                        aria-label="Excluir conta"
                        onClick={() => excluirAcesso(c.id, c.email)}
                        disabled={c.id === meuPerfil.data?.id}
                        className="rounded-full p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                  {acessos.isSuccess && listaAcessos.length === 0 && (
                    <li className="py-4 text-sm text-muted-foreground">
                      Nenhuma solicitação de acesso no momento.
                    </li>
                  )}
                </ul>
                <Paginacao pagina={pgAcessos} totalPaginas={totalPgAcessos} onChange={setPgAcessos} />
              </section>
            </>
          )}
        </div>


        <ResetAnoModal open={resetOpen} onOpenChange={setResetOpen} />
        {dialogoConfirmar}
        <PalestraModal
          open={palestraOpen}
          onOpenChange={setPalestraOpen}
          palestra={palestraEdit}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["palestras"] })}
        />
        <PatrocinadorModal
          open={sponsorOpen}
          onOpenChange={setSponsorOpen}
          patrocinador={sponsorEdit}
          nivelPadrao={nivelAtivo}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["patrocinadores"] })}
        />
        <ComissaoModal
          open={comissaoOpen}
          onOpenChange={setComissaoOpen}
          membro={comissaoEdit}
          grupoPadrao={grupoAtivo}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["comissao"] })}
        />
      </main>
    </>
  );
}

function ConfigField({
  label,
  value,
  onCommit,
  icon,
  className,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  icon?: boolean;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const [dirty, setDirty] = useState(false);

  return (
    <label
      className={`flex h-18.5 flex-col justify-center gap-1 rounded-2xl border border-border/60 bg-field/60 px-5 ${className ?? ""}`}
    >
      <span className={fieldLabel}>{label}</span>
      <span className="flex items-center gap-2">
        {icon && <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <input
          value={dirty ? local : value}
          onChange={(e) => {
            setLocal(e.target.value);
            setDirty(true);
          }}
          onBlur={() => {
            if (dirty) onCommit(local);
            setDirty(false);
          }}
          className="w-full bg-transparent text-[15px] text-foreground outline-none"
        />
      </span>
    </label>
  );
}

// Card de logo dos apoiadores: w-48.75 (195px) com gap-4 (16px)
const LOGO_LARGURA = 195;
const LOGO_GAP = 16;

/** Quantos itens de largura fixa cabem numa linha do container (atualiza ao redimensionar). */
function useCabemNaLinha(ref: React.RefObject<HTMLElement | null>, largura: number, gap: number) {
  const [qtd, setQtd] = useState(5);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setQtd(Math.max(1, Math.floor((el.clientWidth + gap) / (largura + gap))));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, largura, gap]);

  return qtd;
}
