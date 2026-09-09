import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CirclePlus,
  ChevronDown,
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
import { exportarJSON, exportarPDF, importarJSON } from "@/lib/backup";
import {
  NIVEIS,
  formatDia,
  formatHora,
  initials,
  uploadFile,
  type EventConfig,
  type Palestra,
  type Patrocinador,
} from "@/lib/setec";
import { useTheme } from "@/hooks/use-theme";

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
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [sponsorEdit, setSponsorEdit] = useState<Patrocinador | null>(null);
  const [nivelAtivo, setNivelAtivo] = useState<string>("MASTER");
  const [pgPalestras, setPgPalestras] = useState(1);
  const [pgApoiadores, setPgApoiadores] = useState(1);
  const [pgAcessos, setPgAcessos] = useState(1);
  const importRef = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
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

  const removerConta = useServerFn(removerAcesso);

  async function atualizarAcesso(id: string, patch: { role?: AppRole; ativo?: boolean }) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["profiles"] });
    toast.success("Acesso atualizado");
  }

  async function excluirAcesso(id: string) {
    if (!confirm("Excluir definitivamente esta conta de acesso?")) return;
    try {
      await removerConta({ data: { userId: id } });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Conta removida");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover a conta");
    }
  }

  async function updateConfig(patch: Partial<EventConfig>) {

    if (!config.data) return;
    const { error } = await supabase.from("event_config").update(patch).eq("id", config.data.id);
    if (error) {
      toast.error(error.message);
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
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    }
  }

  async function removerPalestra(id: string) {
    const { error } = await supabase.from("palestras").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Palestra removida");
    queryClient.invalidateQueries({ queryKey: ["palestras"] });
  }

  async function removerPatrocinador(id: string) {
    const { error } = await supabase.from("patrocinadores").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Apoiador removido");
    queryClient.invalidateQueries({ queryKey: ["patrocinadores"] });
  }

  async function resetarAno() {
    if (!confirm("Resetar todos os dados do ano? Palestras e apoiadores serão apagados.")) return;
    await supabase.from("palestras").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("patrocinadores").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    queryClient.invalidateQueries();
    toast.success("Dados do ano resetados");
  }

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const PAGE = 3;
  const listaPalestras = palestras.data ?? [];
  const totalPgPalestras = Math.max(1, Math.ceil(listaPalestras.length / PAGE));
  const palestrasPagina = listaPalestras.slice((pgPalestras - 1) * PAGE, pgPalestras * PAGE);

  const doNivel = useMemo(
    () => (patrocinadores.data ?? []).filter((p) => p.nivel === nivelAtivo),
    [patrocinadores.data, nivelAtivo],
  );
  const totalPgApoiadores = Math.max(1, Math.ceil(doNivel.length / PAGE));
  const apoiadoresPagina = doNivel.slice((pgApoiadores - 1) * PAGE, pgApoiadores * PAGE);

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
      toast.error(err instanceof Error ? err.message : "Ocorreu um erro");
    } finally {
      setOcupado(false);
    }
  }

  async function onImportar(file: File | undefined) {
    if (!file) return;
    await comEspera(async () => {
      await importarJSON(file);
      queryClient.invalidateQueries();
    }, "Dados importados");
  }

  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-background px-6 pb-24 pt-8 md:px-16">
        <header className="relative mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4">
          <SetecLogo />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={resetarAno}
              className="flex h-10 items-center gap-2 rounded-full border border-destructive/60 px-5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <RotateCcw className="h-4 w-4" />
              Resetar Dados do Ano
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
                <DropdownMenuContent align="end" className="min-w-[170px]">
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

        <div className="relative mx-auto mt-14 max-w-[1160px]">
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
            <span className="text-xs text-muted-foreground">Logo do Evento</span>
            <div className="mt-3 flex flex-col gap-5 lg:flex-row">
              <button
                onClick={() => logoRef.current?.click()}
                className="flex h-[170px] w-full max-w-[260px] items-center justify-center rounded-[28px] border border-dashed border-border/70 bg-field/40 text-muted-foreground transition-colors hover:border-primary/60"
              >
                <StorageImage
                  path={config.data?.logo_url ?? null}
                  alt="Logo do evento"
                  className="max-h-[120px] max-w-[200px]"
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
                <ConfigField
                  label="Ano"
                  value={config.data?.ano ?? ""}
                  onCommit={(v) => updateConfig({ ano: v })}
                />
                <ConfigField
                  label="Datas"
                  value={config.data?.datas ?? ""}
                  onCommit={(v) => updateConfig({ datas: v })}
                />
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

          {/* Palestras */}
          <h2 className="mt-16 flex items-center gap-3 font-display text-xl font-bold">
            <Mic className="h-5 w-5 text-primary-glow" />
            Gerenciar Palestras
          </h2>
          <section className="panel-surface mt-5 p-7">
            <ul className="divide-y divide-border/40">
              {palestrasPagina.map((p) => (
                <li key={p.id} className="group flex items-center gap-4 py-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-medium text-muted-foreground">
                    <StorageImage
                      path={p.foto_url}
                      alt={p.nome_completo}
                      className="h-11 w-11 object-cover"
                      fallback={<>{initials(p.nome_completo)}</>}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base text-foreground">{p.titulo}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.nome_completo}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold text-foreground">{formatDia(p.data)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatHora(p.hora_inicio)} - {formatHora(p.hora_fim)}
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
            <Paginacao pagina={pgPalestras} totalPaginas={totalPgPalestras} onChange={setPgPalestras} />

            <button
              onClick={() => {
                setPalestraEdit(null);
                setPalestraOpen(true);
              }}
              className="mt-5 flex h-16 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 text-[13px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            >
              <CirclePlus className="h-5 w-5" />
              Cadastrar Nova Palestra
            </button>
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

            <div className="mt-6 flex flex-wrap gap-4">
              {apoiadoresPagina.map((s) => (
                <div
                  key={s.id}
                  className="group relative h-[95px] w-[195px] overflow-hidden rounded-lg border border-border/60 bg-field"
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
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
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
              {doNivel.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum apoiador cadastrado neste nível.
                </p>
              )}
            </div>
            <Paginacao pagina={pgApoiadores} totalPaginas={totalPgApoiadores} onChange={setPgApoiadores} />

            <button
              onClick={() => {
                setSponsorEdit(null);
                setSponsorOpen(true);
              }}
              className="mt-6 flex h-16 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 text-[13px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            >
              <CirclePlus className="h-5 w-5" />
              Adicionar Novo Apoiador
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
                      <select
                        value={c.role}
                        disabled={c.id === meuPerfil.data?.id}
                        onChange={(e) => atualizarAcesso(c.id, { role: e.target.value as AppRole })}
                        className="h-10 rounded-full border border-border/60 bg-field/60 px-4 text-sm text-foreground outline-none disabled:opacity-50"
                      >
                        <option value="admin">Administrador</option>
                        <option value="user">Usuário comum</option>
                      </select>
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
                        onClick={() => excluirAcesso(c.id)}
                        disabled={c.id === meuPerfil.data?.id}
                        className="rounded-full p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                  {listaAcessos.length === 0 && (
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
      className={`flex h-[74px] flex-col justify-center gap-1 rounded-2xl border border-border/60 bg-field/60 px-5 ${className ?? ""}`}
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
