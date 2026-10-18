import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  History,
  Loader2,
  Lock,
  LockOpen,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Snowflake,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { restaurarPonto, type PontoRestauracao } from "@/lib/backup";
import { formatDia, formatHora, mensagemErro } from "@/lib/setec";
import type { OpcoesConfirmar } from "@/components/setec/ConfirmDialog";
import { StatusConsulta } from "@/components/setec/StatusConsulta";
import { StorageImage } from "@/components/setec/StorageImage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Conta = { id: string; email: string; ativo: boolean; master?: boolean };

type Props = {
  contas: Conta[];
  congelado: boolean;
  confirmar: (o: OpcoesConfirmar) => Promise<boolean>;
};

type Aba = "historico" | "restauracao" | "congelar" | "transferir";

const ABAS: { valor: Aba; rotulo: string; detalhe: string; icone: typeof History }[] = [
  { valor: "historico", rotulo: "Histórico", detalhe: "Quem fez o quê", icone: History },
  { valor: "restauracao", rotulo: "Restauração", detalhe: "Desfazer reset e importação", icone: RotateCcw },
  { valor: "congelar", rotulo: "Congelar painel", detalhe: "Só visualização", icone: Snowflake },
  { valor: "transferir", rotulo: "Transferir master", detalhe: "Troca de gestão", icone: ArrowRightLeft },
];

/** Funções exclusivas da conta master. */
export function MasterSection({ contas, congelado, confirmar }: Props) {
  const [aba, setAba] = useState<Aba>("historico");
  return (
    <>
      <h2 className="mt-16 flex items-center gap-3 font-display text-xl font-bold">
        <Crown className="h-5 w-5 text-primary-glow" />
        Área da Master
      </h2>
      <section className="panel-surface mt-5 overflow-hidden p-0">
        <div className="grid lg:grid-cols-[230px_1fr]">
          {/* Navegação: coluna no desktop, faixa rolável no celular */}
          <nav
            aria-label="Funções da master"
            className="flex gap-1 overflow-x-auto border-b border-border/40 p-3 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:p-4"
            role="tablist"
          >
            {ABAS.map(({ valor, rotulo, detalhe, icone: Icone }) => {
              const ativa = aba === valor;
              return (
                <button
                  key={valor}
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => setAba(valor)}
                  className={`flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                    ativa ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-secondary/60"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      ativa ? "bg-primary/25 text-primary-glow" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Icone className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm ${ativa ? "text-foreground" : "text-muted-foreground"}`}>
                      {rotulo}
                    </span>
                    <span className="hidden text-[11px] text-muted-foreground lg:block">{detalhe}</span>
                  </span>
                  {valor === "congelar" && congelado && (
                    <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-sky-400" title="Painel congelado" />
                  )}
                </button>
              );
            })}
          </nav>
          <div className="min-w-0 p-5 lg:p-7" role="tabpanel">
            {aba === "historico" && <Historico contas={contas} confirmar={confirmar} />}
            {aba === "restauracao" && <Restauracao confirmar={confirmar} />}
            {aba === "congelar" && <Congelar congelado={congelado} confirmar={confirmar} />}
            {aba === "transferir" && <Transferir contas={contas} confirmar={confirmar} />}
          </div>
        </div>
      </section>
    </>
  );
}

// ─── Histórico ───────────────────────────────────────────────────────────────

type Registro = {
  id: number;
  criado_em: string;
  usuario_email: string | null;
  acao: string;
  tabela: string | null;
  descricao: string | null;
  campos: string[] | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  desfeito_em?: string | null;
  desfeito_por?: string | null;
};

/** Nome de cada área no singular (rótulo da linha) e com artigo (frases de confirmação). */
const AREAS: Record<string, { nome: string; artigo: string }> = {
  palestras: { nome: "Palestra", artigo: "a palestra" },
  minicursos: { nome: "Minicurso", artigo: "o minicurso" },
  minicurso_inscricoes: { nome: "Inscrição de minicurso", artigo: "a inscrição" },
  patrocinadores: { nome: "Apoiador", artigo: "o apoiador" },
  comissao: { nome: "Comissão", artigo: "o membro da comissão" },
  event_config: { nome: "Informações do evento", artigo: "as informações do evento" },
  presencas: { nome: "Presença", artigo: "a presença" },
  presenca_qrcodes: { nome: "QR Code", artigo: "o QR Code" },
  presenca_turmas: { nome: "Turma", artigo: "a turma" },
  profiles: { nome: "Conta de acesso", artigo: "a conta" },
};

const FILTRO_AREAS: [string, string][] = [
  ["", "Todas as áreas"],
  ["palestras", "Palestras"],
  ["minicursos", "Minicursos"],
  ["minicurso_inscricoes", "Inscrições"],
  ["patrocinadores", "Apoiadores"],
  ["comissao", "Comissão"],
  ["event_config", "Evento"],
  ["presencas", "Presenças"],
  ["profiles", "Contas"],
  ["-", "Ações do painel"],
];

const FILTRO_ACOES: [string, string][] = [
  ["", "Todas as ações"],
  ["criou", "Criou"],
  ["alterou", "Alterou"],
  ["excluiu", "Excluiu"],
];

/** Campos mostrados na comparação, na ordem em que aparecem (os demais são técnicos). */
const CAMPOS: [string, string][] = [
  ["titulo", "Título"],
  ["nome_empresa", "Empresa"],
  ["nome", "Nome"],
  ["nome_completo", "Nome"],
  ["edicao", "Edição"],
  ["palestrantes", "Palestrantes"],
  ["ministrantes", "Ministrantes"],
  ["logo_url", "Logo"],
  ["foto_url", "Foto"],
  ["categoria", "Categoria"],
  ["data", "Data"],
  ["datas", "Datas"],
  ["ano", "Ano"],
  ["hora_inicio", "Início"],
  ["hora_fim", "Término"],
  ["local", "Local"],
  ["vagas", "Vagas"],
  ["nivel", "Nível"],
  ["grupo", "Grupo"],
  ["semestre", "Semestre"],
  ["ra", "RA"],
  ["email", "E-mail"],
  ["turma", "Turma"],
  ["ano_turma", "Turma"],
  ["role", "Nível de acesso"],
  ["ativo", "Acesso liberado"],
  ["acesso_total_ate", "Acesso total até"],
  ["evento_ativo", "Evento ativo"],
  ["rascunho", "Rascunho"],
  ["sympla_url", "Sympla"],
  ["instagram_url", "Instagram"],
  ["sobre_palestra", "Sobre a palestra"],
  ["sobre", "Sobre"],
  ["links", "Links"],
  ["localizacao", "Local do registro"],
];
const ROTULO_CAMPO = new Map(CAMPOS);
const ORDEM_CAMPO = new Map(CAMPOS.map(([c], i) => [c, i]));

/** Colunas antigas das palestras que o banco copia de "palestrantes": não precisam aparecer. */
const DERIVADOS: Record<string, string[]> = {
  palestras: ["foto_url", "nome_completo", "cargo", "sobre_palestrante"],
};

const IMAGENS = new Set(["logo_url", "foto_url"]);
const PESSOAS = new Set(["palestrantes", "ministrantes"]);

/** Campos que valem mostrar de um registro, já na ordem certa. */
function camposVisiveis(r: Registro, chaves: string[]) {
  const ocultos = new Set(DERIVADOS[r.tabela ?? ""] ?? []);
  return chaves
    .filter((c) => ROTULO_CAMPO.has(c) && !ocultos.has(c))
    .sort((a, b) => (ORDEM_CAMPO.get(a) ?? 99) - (ORDEM_CAMPO.get(b) ?? 99));
}

const vazio = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function rotuloDia(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

/** Nome curto para a lista (parte antes do @). */
const quem = (email: string | null) => (email ? (email.split("@")[0] ?? email) : "Alguém");

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Título da linha: o nome do item (ou a ação, para ações gerais do painel). */
function tituloRegistro(r: Registro) {
  if (!r.tabela) {
    const d = r.descricao ?? "";
    switch (r.acao) {
      case "congelou":
        return "Congelou o painel";
      case "descongelou":
        return "Descongelou o painel";
      case "resetou":
        return "Resetou os dados do ano";
      case "transferiu master":
        return `Transferiu a conta master ${d.replace(/^Para /, "para ")}`;
      case "enviou redefinição de senha":
        return `Enviou redefinição de senha para ${d}`;
      case "apagou o histórico":
        return `Apagou o histórico (${d})`;
      default:
        return maiuscula(`${r.acao} ${d}`.trim());
    }
  }
  const linha = r.depois ?? r.antes ?? {};
  const nome =
    r.descricao ??
    ["titulo", "nome_empresa", "nome", "nome_completo", "email", "edicao"]
      .map((c) => linha[c])
      .find((v): v is string => typeof v === "string" && !!v);
  return nome || AREAS[r.tabela]?.nome || r.tabela;
}

/** Linha de baixo: área, o que aconteceu e quem fez. */
function detalheRegistro(r: Registro) {
  const autor = quem(r.usuario_email);
  if (!r.tabela) return `por ${autor}`;
  const area = AREAS[r.tabela]?.nome ?? r.tabela;
  if (r.acao === "alterou") {
    const campos = camposVisiveis(r, r.campos ?? []).map((c) => ROTULO_CAMPO.get(c)!.toLowerCase());
    const unicos = [...new Set(campos)];
    return `${area} • ${unicos.length ? `alterou ${unicos.join(", ")}` : "alterou"} • ${autor}`;
  }
  return `${area} • ${r.acao === "criou" ? "criado" : "excluído"} por ${autor}`;
}

function podeDesfazer(r: Registro) {
  if (r.desfeito_em || !r.tabela) return false;
  if (!["criou", "alterou", "excluiu"].includes(r.acao)) return false;
  if (r.tabela === "profiles" && r.acao !== "alterou") return false;
  return true;
}

const ESTILO_ACAO: Record<string, { icone: typeof Plus; cor: string }> = {
  criou: { icone: Plus, cor: "bg-emerald-500/15 text-emerald-400" },
  alterou: { icone: Pencil, cor: "bg-primary/15 text-primary-glow" },
  excluiu: { icone: Minus, cor: "bg-destructive/15 text-destructive" },
};

function Seletor({
  valor,
  onChange,
  opcoes,
  rotulo,
  largo = false,
}: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: [string, string][];
  rotulo: string;
  largo?: boolean;
}) {
  return (
    <div className={largo ? "relative w-full" : "relative w-fit max-w-full"}>
      <select
        aria-label={rotulo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`field-pill h-10 max-w-full appearance-none py-0 pl-4 pr-10 text-sm ${largo ? "w-full" : ""}`}
      >
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

// ── Valores na comparação ──

function Imagem({ path }: { path: string }) {
  return (
    <StorageImage
      path={path}
      alt=""
      className="h-20 max-w-full rounded-lg border border-border/50 bg-background/60 object-contain p-1"
      fallback={<span className="text-xs text-muted-foreground">imagem indisponível</span>}
    />
  );
}

type Pessoa = { nome?: string; cargo?: string | null; foto_url?: string | null };

function Valor({ campo, valor }: { campo: string; valor: unknown }) {
  if (vazio(valor)) return <span className="text-xs italic text-muted-foreground">vazio</span>;
  if (IMAGENS.has(campo)) {
    const lista = (Array.isArray(valor) ? valor : [valor]).filter((v): v is string => typeof v === "string" && !!v);
    return (
      <div className="flex flex-wrap gap-2">
        {lista.map((p) => (
          <Imagem key={p} path={p} />
        ))}
      </div>
    );
  }
  if (PESSOAS.has(campo) && Array.isArray(valor)) {
    return (
      <ul className="space-y-2">
        {(valor as Pessoa[]).map((p, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <StorageImage
              path={p.foto_url ?? null}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
              fallback={
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] text-muted-foreground">
                  {(p.nome ?? "?").slice(0, 2).toUpperCase()}
                </span>
              }
            />
            <span className="min-w-0">
              <span className="block truncate text-foreground">{p.nome || "Sem nome"}</span>
              {p.cargo && <span className="block truncate text-xs text-muted-foreground">{p.cargo}</span>}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (campo === "links" && Array.isArray(valor)) {
    return (
      <ul className="space-y-1 text-xs">
        {(valor as { url?: string; type?: string }[]).map((l, i) => (
          <li key={i} className="break-all">
            {l.type && <span className="mr-1.5 text-muted-foreground">{l.type}</span>}
            {l.url}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof valor === "boolean") return <span>{valor ? "Sim" : "Não"}</span>;
  if (campo === "data" && typeof valor === "string") return <span>{formatDia(valor)}</span>;
  if ((campo === "hora_inicio" || campo === "hora_fim") && typeof valor === "string") {
    return <span className="tabular-nums">{formatHora(valor)}</span>;
  }
  if (campo === "acesso_total_ate" && typeof valor === "string") {
    return <span>{new Date(valor).toLocaleString("pt-BR")}</span>;
  }
  if (campo === "role") return <span>{valor === "admin" ? "Administrador" : "Usuário comum"}</span>;
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
  return <span className="block max-h-40 overflow-y-auto whitespace-pre-wrap break-words">{texto}</span>;
}

/** Antes e depois lado a lado (alteração) ou o item como ficou (criação/exclusão). */
function Comparacao({ r }: { r: Registro }) {
  if (r.acao === "alterou") {
    const campos = camposVisiveis(r, r.campos ?? []);
    if (!campos.length) {
      return <p className="text-xs text-muted-foreground">Só campos internos do sistema foram alterados.</p>;
    }
    return (
      <div className="overflow-hidden rounded-xl border border-border/50">
        <div className="grid grid-cols-[minmax(90px,140px)_1fr_1fr] bg-background/40 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <span className="px-3 py-2">Campo</span>
          <span className="border-l border-border/40 px-3 py-2 text-destructive/90">Antes</span>
          <span className="border-l border-border/40 px-3 py-2 text-emerald-400">Depois</span>
        </div>
        {campos.map((c) => (
          <div key={c} className="grid grid-cols-[minmax(90px,140px)_1fr_1fr] border-t border-border/40 text-sm">
            <span className="px-3 py-2.5 text-xs text-muted-foreground">{ROTULO_CAMPO.get(c)}</span>
            <div className="min-w-0 border-l border-border/40 bg-destructive/[0.04] px-3 py-2.5 text-foreground/80">
              <Valor campo={c} valor={r.antes?.[c]} />
            </div>
            <div className="min-w-0 border-l border-border/40 bg-emerald-500/[0.04] px-3 py-2.5 text-foreground">
              <Valor campo={c} valor={r.depois?.[c]} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  const linha = (r.acao === "criou" ? r.depois : r.antes) ?? {};
  const campos = camposVisiveis(r, Object.keys(linha)).filter((c) => !vazio(linha[c]));
  if (!campos.length) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-border/50">
      <p
        className={`px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] ${
          r.acao === "criou" ? "bg-emerald-500/[0.06] text-emerald-400" : "bg-destructive/[0.06] text-destructive/90"
        }`}
      >
        {r.acao === "criou" ? "Como foi criado" : "Como estava antes de ser excluído"}
      </p>
      {campos.map((c) => (
        <div key={c} className="grid grid-cols-[minmax(90px,140px)_1fr] border-t border-border/40 text-sm">
          <span className="px-3 py-2.5 text-xs text-muted-foreground">{ROTULO_CAMPO.get(c)}</span>
          <div className="min-w-0 border-l border-border/40 px-3 py-2.5 text-foreground">
            <Valor campo={c} valor={linha[c]} />
          </div>
        </div>
      ))}
    </div>
  );
}

const POR_PAGINA = 15;

// ── Lista ──

function Historico({ contas, confirmar }: { contas: Conta[]; confirmar: Props["confirmar"] }) {
  const queryClient = useQueryClient();
  const [pessoa, setPessoa] = useState("");
  const [acao, setAcao] = useState("");
  const [area, setArea] = useState("");
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState<number | null>(null);
  const [desfazendo, setDesfazendo] = useState<number | null>(null);
  const [apagando, setApagando] = useState(false);

  const consulta = useQuery({
    queryKey: ["auditoria", pessoa, acao, area, pagina],
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      let q = supabase
        .from("auditoria" as any)
        .select("*", { count: "exact" })
        .order("criado_em", { ascending: false })
        .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
      if (pessoa) q = q.eq("usuario_email", pessoa);
      if (acao) q = q.eq("acao", acao);
      if (area === "-") q = q.is("tabela", null);
      else if (area) q = q.eq("tabela", area);
      const { data, error, count } = await q;
      if (error) throw error;
      return { linhas: (data ?? []) as unknown as Registro[], total: count ?? 0 };
    },
  });

  const filtrar = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPagina(1);
    setAberto(null);
  };
  const linhas = consulta.data?.linhas ?? [];
  const total = consulta.data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const inicio = total ? (pagina - 1) * POR_PAGINA + 1 : 0;
  const fim = Math.min(pagina * POR_PAGINA, total);

  // Resumo dos filtros dentro da pílula
  const ativos = [
    pessoa && quem(pessoa),
    acao && FILTRO_ACOES.find(([v]) => v === acao)?.[1],
    area && FILTRO_AREAS.find(([v]) => v === area)?.[1],
  ].filter(Boolean) as string[];

  // Agrupa por dia: "Hoje", "Ontem", "sexta-feira, 16 de outubro"...
  const grupos = useMemo(() => {
    const mapa = new Map<string, Registro[]>();
    for (const r of linhas) {
      const dia = rotuloDia(r.criado_em);
      mapa.set(dia, [...(mapa.get(dia) ?? []), r]);
    }
    return [...mapa.entries()];
  }, [linhas]);

  async function desfazer(r: Registro) {
    const item = r.tabela ? (AREAS[r.tabela]?.artigo ?? r.tabela) : "o item";
    const nome = ` “${tituloRegistro(r)}”`;
    const texto =
      r.acao === "alterou"
        ? `Os campos alterados de ${item}${nome} voltam ao valor anterior.`
        : r.acao === "excluiu"
          ? `${maiuscula(item)}${nome} volta a existir, como estava antes de ser excluído.`
          : `${maiuscula(item)}${nome} criado nessa ação será apagado.`;
    const ok = await confirmar({
      tom: r.acao === "criou" ? "perigo" : "aviso",
      titulo: "Desfazer alteração",
      descricao: (
        <>
          <span className="block">{texto}</span>
          {(r.tabela === "palestras" || r.tabela === "minicursos") && r.acao !== "alterou" && (
            <span className="mt-2 block">
              {r.tabela === "palestras" ? "Presenças e QR Codes" : "Inscrições"} ligados a ele aparecem como itens
              separados no histórico e são desfeitos um a um.
            </span>
          )}
        </>
      ),
      confirmar: "Desfazer",
    });
    if (!ok) return;
    setDesfazendo(r.id);
    const { error } = await supabase.rpc("desfazer_atividade" as any, { _id: r.id } as any);
    setDesfazendo(null);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    toast.success("Alteração desfeita");
    queryClient.invalidateQueries();
  }

  async function apagarHistorico() {
    const ok = await confirmar({
      tom: "perigo",
      titulo: "Apagar histórico",
      descricao: (
        <>
          <span className="block">
            Todos os registros do histórico são apagados de vez, inclusive os que estão fora dos filtros. Depois disso
            não dá mais para ver nem desfazer essas alterações, e o histórico apagado não pode ser restaurado.
          </span>
          <span className="mt-2 block">Fica só um registro dizendo que você apagou o histórico.</span>
        </>
      ),
      confirmar: "Apagar histórico",
    });
    if (!ok) return;
    setApagando(true);
    const { data, error } = await supabase.rpc("apagar_historico" as any);
    setApagando(false);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    const n = Number(data ?? 0);
    toast.success(`Histórico apagado (${n} ${n === 1 ? "registro" : "registros"})`);
    setPagina(1);
    setAberto(null);
    queryClient.invalidateQueries({ queryKey: ["auditoria"] });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filtros numa pílula só */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`field-pill flex h-10 max-w-full items-center gap-2.5 pl-4 pr-3 text-sm ${
                ativos.length ? "border-primary/50" : ""
              }`}
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{ativos.length ? ativos.join(" • ") : "Todas as atividades"}</span>
              {ativos.length > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary/25 px-1.5 text-[11px] text-primary-glow">
                  {ativos.length}
                </span>
              )}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[70vh] w-64 overflow-y-auto">
            <DropdownMenuLabel>Pessoa</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={pessoa} onValueChange={filtrar(setPessoa)}>
              <DropdownMenuRadioItem value="">Todas as pessoas</DropdownMenuRadioItem>
              {contas.map((c) => (
                <DropdownMenuRadioItem key={c.id} value={c.email}>
                  <span className="truncate">{c.email}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Ação</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={acao} onValueChange={filtrar(setAcao)}>
              {FILTRO_ACOES.map(([v, r]) => (
                <DropdownMenuRadioItem key={v} value={v}>
                  {r}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Área</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={area} onValueChange={filtrar(setArea)}>
              {FILTRO_AREAS.map(([v, r]) => (
                <DropdownMenuRadioItem key={v} value={v}>
                  {r}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {ativos.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setPessoa("");
                    setAcao("");
                    setArea("");
                    setPagina(1);
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Limpar filtros
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={apagarHistorico}
          disabled={apagando || total === 0}
          className="flex h-10 items-center gap-2 rounded-full border border-border/70 px-4 text-sm text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive disabled:opacity-40"
        >
          {apagando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Apagar histórico
        </button>
      </div>

      <StatusConsulta consulta={consulta} nome="o histórico" />

      {/* Caixa com altura fixa: a página rola por dentro, sem empurrar o painel */}
      <div className="mt-4 h-[460px] overflow-y-auto rounded-2xl border border-border/50 bg-field/30">
        {grupos.map(([dia, registros]) => (
          <div key={dia}>
            <p className="sticky top-0 z-10 border-b border-border/40 bg-card/95 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
              {dia}
            </p>
            <ul className="divide-y divide-border/30">
              {registros.map((r) => {
                const estilo = ESTILO_ACAO[r.acao] ?? { icone: History, cor: "bg-secondary text-muted-foreground" };
                const Icone = estilo.icone;
                const desfeito = !!r.desfeito_em;
                const temDetalhe = !!r.tabela && (r.acao === "alterou" || !!(r.antes || r.depois));
                const expandido = aberto === r.id;
                return (
                  <li key={r.id} className={expandido ? "bg-background/30" : ""}>
                    <button
                      onClick={() => temDetalhe && setAberto(expandido ? null : r.id)}
                      aria-expanded={temDetalhe ? expandido : undefined}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                        temDetalhe ? "hover:bg-secondary/40" : "cursor-default"
                      } ${desfeito ? "opacity-55" : ""}`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${estilo.cor}`}>
                        <Icone className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{tituloRegistro(r)}</span>
                          {desfeito && (
                            <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                              desfeito
                            </span>
                          )}

                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{detalheRegistro(r)}</span>
                      </span>
                      <time
                        dateTime={r.criado_em}
                        title={new Date(r.criado_em).toLocaleString("pt-BR")}
                        className="shrink-0 text-xs tabular-nums text-muted-foreground"
                      >
                        {hora(r.criado_em)}
                      </time>
                      {temDetalhe && (
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expandido ? "rotate-180" : ""}`}
                        />
                      )}
                    </button>
                    {expandido && (
                      <div className="space-y-3 px-4 pb-4 sm:pl-15">
                        <Comparacao r={r} />
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>
                            {desfeito
                              ? `Desfeito por ${quem(r.desfeito_por ?? null)} em ${new Date(r.desfeito_em!).toLocaleString("pt-BR")}`
                              : `${new Date(r.criado_em).toLocaleString("pt-BR")} • ${r.usuario_email ?? ""}`}
                          </span>
                          {podeDesfazer(r) && (
                            <button
                              onClick={() => desfazer(r)}
                              disabled={desfazendo !== null}
                              className="flex h-9 items-center gap-2 rounded-full border border-border/70 px-4 text-sm text-foreground transition-colors hover:border-primary/60 disabled:opacity-50"
                            >
                              {desfazendo === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Undo2 className="h-4 w-4" />
                              )}
                              Desfazer
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {consulta.isSuccess && total === 0 && (
          <p className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {ativos.length ? "Nenhuma atividade com esses filtros." : "Nenhuma atividade registrada."}
          </p>
        )}
        {consulta.isLoading && (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando…
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {total ? `${inicio}–${fim} de ${total} registros` : "Sem registros"} • clique em um item para ver o que mudou
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPagina((p) => p - 1);
              setAberto(null);
            }}
            disabled={pagina <= 1}
            aria-label="Mais recentes"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="tabular-nums">
            {pagina} / {totalPaginas}
          </span>
          <button
            onClick={() => {
              setPagina((p) => p + 1);
              setAberto(null);
            }}
            disabled={pagina >= totalPaginas}
            aria-label="Mais antigos"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 hover:text-foreground disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pontos de restauração ───────────────────────────────────────────────────

function resumoTexto(r: PontoRestauracao["resumo"]) {
  if (!r) return "";
  const itens: [number, string, string][] = [
    [r.palestras, "palestra", "palestras"],
    [r.minicursos, "minicurso", "minicursos"],
    [r.inscricoes, "inscrição", "inscrições"],
    [r.presencas, "presença", "presenças"],
    [r.apoiadores, "apoiador", "apoiadores"],
    [r.comissao, "membro da comissão", "membros da comissão"],
  ];
  const partes = itens.filter(([n]) => n > 0).map(([n, um, varios]) => `${n} ${n === 1 ? um : varios}`);
  return partes.length ? partes.join(" · ") : "sem dados";
}

function Restauracao({ confirmar }: { confirmar: Props["confirmar"] }) {
  const queryClient = useQueryClient();
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const pontos = useQuery({
    queryKey: ["pontos_restauracao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pontos_restauracao" as any)
        .select("id, criado_em, criado_por_email, motivo, resumo")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PontoRestauracao[];
    },
  });

  async function restaurar(p: PontoRestauracao) {
    const data = new Date(p.criado_em).toLocaleString("pt-BR");
    const ok = await confirmar({
      tom: "perigo",
      titulo: "Restaurar ponto",
      descricao: (
        <>
          <span className="block">
            Os dados do ano voltam a ficar exatamente como estavam em <strong className="text-foreground">{data}</strong>{" "}
            ({p.motivo.toLowerCase()}).
          </span>
          <span className="mt-2 block">
            Antes, os dados atuais são guardados em um novo ponto de restauração, então dá para desfazer.
          </span>
        </>
      ),
      confirmar: "Restaurar",
    });
    if (!ok) return;
    setRestaurando(p.id);
    try {
      await restaurarPonto(p);
      await queryClient.invalidateQueries();
      toast.success("Dados restaurados");
    } catch (err) {
      toast.error(mensagemErro(err, "Não foi possível restaurar"));
    } finally {
      setRestaurando(null);
    }
  }

  async function apagar(p: PontoRestauracao) {
    const ok = await confirmar({
      tom: "perigo",
      titulo: "Apagar ponto de restauração",
      descricao: "Essa cópia deixa de existir e não poderá mais ser restaurada.",
      confirmar: "Apagar",
    });
    if (!ok) return;
    const { error } = await supabase.from("pontos_restauracao" as any).delete().eq("id", p.id);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["pontos_restauracao"] });
    toast.success("Ponto apagado");
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Antes de cada <strong className="text-foreground">reset</strong> ou{" "}
        <strong className="text-foreground">importação</strong>, o painel guarda uma cópia completa dos dados. Ficam
        os 10 pontos mais recentes.
      </p>
      <StatusConsulta consulta={pontos} nome="os pontos de restauração" />
      <ul className="mt-4 space-y-3">
        {(pontos.data ?? []).map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/50 bg-field/40 px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] text-foreground">{p.motivo}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(p.criado_em).toLocaleString("pt-BR")}
                {p.criado_por_email && ` • por ${p.criado_por_email}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{resumoTexto(p.resumo)}</p>
            </div>
            <button
              onClick={() => restaurar(p)}
              disabled={restaurando !== null}
              className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-50"
            >
              {restaurando === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {restaurando === p.id ? "Restaurando…" : "Restaurar"}
            </button>
            <button
              onClick={() => apagar(p)}
              disabled={restaurando !== null}
              aria-label="Apagar ponto de restauração"
              className="rounded-full p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {pontos.isSuccess && pontos.data.length === 0 && (
          <li className="text-sm text-muted-foreground">
            Nenhum ponto ainda. O primeiro é criado no próximo reset ou importação.
          </li>
        )}
      </ul>
    </div>
  );
}

// ─── Congelar painel ─────────────────────────────────────────────────────────

function Congelar({ congelado, confirmar }: { congelado: boolean; confirmar: Props["confirmar"] }) {
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);

  async function alternar() {
    const ok = await confirmar({
      tom: congelado ? "neutro" : "aviso",
      titulo: congelado ? "Descongelar painel" : "Congelar painel",
      descricao: congelado
        ? "Todas as contas voltam a poder editar o painel, conforme o nível de cada uma."
        : "As outras contas passam a só visualizar o painel: ninguém cria, edita ou apaga nada. Só você e quem tiver acesso total temporário continuam editando. Inscrições e presenças feitas pelos alunos no site continuam funcionando.",
      confirmar: congelado ? "Descongelar" : "Congelar",
    });
    if (!ok) return;
    setSalvando(true);
    const { error } = await supabase.rpc("definir_congelamento" as any, { _congelar: !congelado } as any);
    setSalvando(false);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["painel_controle"] });
    toast.success(congelado ? "Painel descongelado" : "Painel congelado");
  }

  return (
    <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border/50 bg-field/40 px-5 py-5">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          congelado ? "bg-sky-400/15 text-sky-300" : "bg-secondary text-muted-foreground"
        }`}
      >
        {congelado ? <Lock className="h-5 w-5" /> : <LockOpen className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-foreground">{congelado ? "Painel congelado" : "Painel liberado para edição"}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {congelado
            ? "As outras contas só visualizam. Ideal durante a semana do evento."
            : "Congele para impedir mudanças de última hora enquanto o evento acontece."}
        </p>
      </div>
      <button
        onClick={alternar}
        disabled={salvando}
        className={`flex h-10 items-center gap-2 rounded-full px-5 text-sm transition-colors disabled:opacity-50 ${
          congelado
            ? "border border-border/70 text-muted-foreground hover:text-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary-glow"
        }`}
      >
        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Snowflake className="h-4 w-4" />}
        {congelado ? "Descongelar" : "Congelar painel"}
      </button>
    </div>
  );
}

// ─── Transferir master ───────────────────────────────────────────────────────

function Transferir({ contas, confirmar }: { contas: Conta[]; confirmar: Props["confirmar"] }) {
  const queryClient = useQueryClient();
  const [destino, setDestino] = useState("");
  const [digitado, setDigitado] = useState("");
  const [salvando, setSalvando] = useState(false);
  const candidatas = contas.filter((c) => c.ativo && !c.master);
  const confere = !!destino && digitado.trim().toLowerCase() === destino.toLowerCase();

  async function transferir() {
    if (!confere) return;
    const ok = await confirmar({
      tom: "perigo",
      titulo: "Transferir conta master",
      descricao: (
        <>
          <strong className="text-foreground">{destino}</strong> passa a ser a conta master. Sua conta continua como
          administrador, mas perde as funções da master — só a nova master poderá devolvê-las.
        </>
      ),
      confirmar: "Transferir",
    });
    if (!ok) return;
    setSalvando(true);
    const { error } = await supabase.rpc("transferir_master" as any, { _email: destino } as any);
    setSalvando(false);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    toast.success(`${destino} agora é a conta master`);
    setDestino("");
    setDigitado("");
    queryClient.invalidateQueries();
  }

  return (
    <div className="max-w-xl">
      <p className="text-sm text-muted-foreground">
        Use na troca de gestão da SETEC. A conta escolhida vira a master; a sua continua como administrador.
      </p>
      <div className="mt-5 space-y-3">
        <Campo rotulo="Nova conta master">
          <Seletor
            rotulo="Nova conta master"
            largo
            valor={destino}
            onChange={(v) => {
              setDestino(v);
              setDigitado("");
            }}
            opcoes={[["", "Escolha uma conta liberada"], ...candidatas.map((c) => [c.email, c.email] as [string, string])]}
          />
        </Campo>
        {destino && (
          <Campo rotulo={`Para confirmar, digite ${destino}`}>
            <input
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              placeholder={destino}
              autoComplete="off"
              spellCheck={false}
              className="field-pill h-10 w-full px-4 text-sm"
            />
          </Campo>
        )}
        <button
          onClick={transferir}
          disabled={!confere || salvando}
          className="flex h-10 items-center gap-2 rounded-full border border-destructive/60 px-5 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
          Transferir conta master
        </button>
      </div>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-muted-foreground">{rotulo}</span>
      {children}
    </label>
  );
}
