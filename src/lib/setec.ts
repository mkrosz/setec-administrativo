import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "setec-bucket";

export const NIVEIS = ["MASTER", "DIAMOND", "TITANIUM", "PLATINUM", "GOLD"] as const;
export type Nivel = (typeof NIVEIS)[number];

export const CATEGORIAS = [
  "Inteligência Artificial",
  "Desenvolvimento",
  "Cibersegurança",
  "Dados & Cloud",
  "Design & UX",
  "Carreira",
  "Inovação",
];

/**
 * Grupos da comissão, nesta ordem. Os cursos da manhã e da noite são semestrais:
 * o membro informa o semestre (manhã: 1º ao 6º; noite: 1º ao 8º).
 */
export const GRUPOS_COMISSAO = [
  { value: "professor", label: "Professores", semestres: 0 },
  { value: "5ano", label: "5º ano", semestres: 0 },
  { value: "4ano", label: "4º ano", semestres: 0 },
  { value: "manha", label: "Manhã", semestres: 6 },
  { value: "noite", label: "Noite", semestres: 8 },
] as const;

export type GrupoComissao = (typeof GRUPOS_COMISSAO)[number]["value"];

/** Quantidade de semestres do grupo (0 = não usa semestre). */
export function semestresDoGrupo(grupo: GrupoComissao): number {
  return GRUPOS_COMISSAO.find((g) => g.value === grupo)?.semestres ?? 0;
}

export type MembroComissao = {
  id: string;
  nome: string;
  email: string | null;
  grupo: GrupoComissao;
  /** Só nos grupos "manha" e "noite" (supabase/sql/comissao-semestres.sql). */
  semestre?: number | null;
  created_at: string;
  updated_at: string;
};

/** Membros por semestre (1º, 2º...), cada lista em ordem alfabética. */
export function porSemestre(membros: MembroComissao[]) {
  const mapa = new Map<number, MembroComissao[]>();
  for (const m of membros) {
    const k = m.semestre ?? 0;
    mapa.set(k, [...(mapa.get(k) ?? []), m]);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => (a || 99) - (b || 99))
    .map(([semestre, lista]) => ({
      semestre,
      membros: lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    }));
}

export const LINK_TYPES = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "site", label: "Site" },
  { value: "instagram", label: "Instagram" },
  { value: "github", label: "GitHub" },
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "X / Twitter" },
  { value: "youtube", label: "YouTube" },
] as const;

export type LinkType = (typeof LINK_TYPES)[number]["value"];

export type PalestraLink = {
  type: LinkType;
  url: string;
};

/** Garante o protocolo (https://) e retorna "" se estiver vazio. */
export function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export type Palestrante = {
  nome: string;
  cargo: string | null;
  foto_url: string | null;
  sobre: string | null;
};

export type Palestra = {
  id: string;
  /** Lista ordenada de palestrantes (fonte da verdade). */
  palestrantes: Palestrante[] | null;
  /** Colunas antigas, mantidas em sincronia pelo banco a partir de `palestrantes`. */
  foto_url: string | string[] | null;
  nome_completo: string;
  cargo: string | null;
  titulo: string;
  categoria: string | null;
  data: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  local: string | null;
  sobre_palestra: string | null;
  sobre_palestrante: string | null;
  links: PalestraLink[] | null;
  rascunho: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Palestrantes de uma palestra. Usa a coluna `palestrantes` e, se ela ainda
 * estiver vazia (SQL não executado ou backup antigo), monta a partir das colunas antigas.
 */
export function palestrantesDe(
  p: Pick<Palestra, "palestrantes" | "nome_completo" | "cargo" | "sobre_palestrante" | "foto_url">,
): Palestrante[] {
  if (Array.isArray(p.palestrantes) && p.palestrantes.length > 0) {
    return p.palestrantes.map((x) => ({
      nome: x?.nome ?? "",
      cargo: x?.cargo ?? null,
      foto_url: x?.foto_url ?? null,
      sobre: x?.sobre ?? null,
    }));
  }
  const fotos = Array.isArray(p.foto_url) ? p.foto_url : p.foto_url ? [p.foto_url] : [];
  if (!p.nome_completo && !p.cargo && !p.sobre_palestrante && fotos.length === 0) return [];
  return [
    {
      nome: p.nome_completo ?? "",
      cargo: p.cargo ?? null,
      foto_url: fotos[0] ?? null,
      sobre: p.sobre_palestrante ?? null,
    },
  ];
}

/** Nomes dos palestrantes separados por vírgula ("" se não houver). */
export function nomesPalestrantes(p: Parameters<typeof palestrantesDe>[0]) {
  return palestrantesDe(p)
    .map((x) => x.nome.trim())
    .filter(Boolean)
    .join(", ");
}

export type Minicurso = {
  id: string;
  titulo: string;
  ministrantes: Palestrante[] | null;
  categoria: string | null;
  data: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  local: string | null;
  sobre: string | null;
  links: PalestraLink[] | null;
  vagas: number;
  rascunho: boolean;
  created_at: string;
  updated_at: string;
};

export type InscricaoMinicurso = {
  id: string;
  minicurso_id: string;
  nome_completo: string;
  ra: string;
  email: string;
  /** Nome da turma (ex.: "4º ano", "N/A"). */
  turma: string;
  origem: "site" | "manual";
  created_at: string;
  /** Preenchidos após rodar supabase/sql/minicursos-email.sql. */
  email_enviado_em?: string | null;
  email_erro?: string | null;
};

export type Patrocinador = {
  id: string;
  nome_empresa: string;
  logo_url: string | null;
  nivel: string;
  created_at: string;
  updated_at: string;
};

export type EventConfig = {
  id: string;
  logo_url: string | null;
  edicao: string;
  ano: string;
  datas: string;
  sympla_url: string;
  instagram_url: string;
  evento_ativo: boolean;
};

/** Uploads a file to the event bucket and returns the stored object path. */
export async function uploadFile(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Resolves a stored object path (or absolute URL) to a displayable public URL. */
export async function resolveUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (typeof pathOrUrl !== "string") return null;

  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  const cleanPath = pathOrUrl.startsWith("/") ? pathOrUrl.slice(1) : pathOrUrl;

  if (cleanPath.startsWith("storage/v1/object/public/")) {
    const supabaseUrl = (import.meta.env["VITE_SUPABASE_URL"] as string) ?? "";
    return `${supabaseUrl}/${cleanPath}`;
  }

  // Tenta gerar a URL pública primeiro (mais rápido e seguro para exibição de assets públicos)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(cleanPath);
  if (data?.publicUrl) {
    return data.publicUrl;
  }

  // Fallback para URL assinada caso o bucket seja estritamente privado
  try {
    const { data: signedData } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(cleanPath, 60 * 60 * 24);
    return signedData?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts[1]?.[0] ?? "";
  const letters = `${first}${second}`;
  return letters.toUpperCase();
}

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Maio",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function formatDia(data: string | null) {
  if (!data) return "";
  const [, m, d] = data.split("-").map(Number);
  return `${d} ${MESES[(m ?? 1) - 1]}`;
}

export function formatHora(h: string | null) {
  if (!h) return "";
  return h.slice(0, 5);
}

/** Opção fixa para quem não pertence a nenhuma turma cadastrada. */
export const TURMA_NA = "N/A";

export type Turma = { id: string; nome: string; created_at: string };

/** Ordena nomes de turma de forma natural ("2º ano" antes de "10º ano"). */
export function compararTurmas(a: string, b: string) {
  if (a === TURMA_NA) return 1;
  if (b === TURMA_NA) return -1;
  return a.localeCompare(b, "pt-BR", { numeric: true });
}

export type Presenca = {
  id: string;
  palestra_id: string;
  qrcode_id: string | null;
  nome_completo: string;
  ra: string;
  /** Nome da turma (ex.: "4º ano", "Logística", "N/A"). */
  ano_turma: string;
  origem: "qrcode" | "manual";
  latitude: number | null;
  longitude: number | null;
  precisao_m: number | null;
  localizacao: string | null;
  registrado_em: string;
  created_at: string;
};

export type PresencaQrCode = {
  id: string;
  palestra_id: string;
  token: string;
  expira_em: string;
  encerrado: boolean;
  created_at: string;
};

export function coordenadasPresenca(p: Presenca) {
  if (p.latitude == null || p.longitude == null) return null;
  const coords = `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;
  return p.precisao_m != null ? `${coords} (±${Math.round(p.precisao_m)} m)` : coords;
}

/** Texto do local de submissão: nome do local, coordenadas ou aviso. */
export function formatLocalPresenca(p: Presenca) {
  return p.localizacao || coordenadasPresenca(p) || "Localização não informada";
}

export function mapsUrl(p: Presenca) {
  if (p.latitude == null || p.longitude == null) return null;
  return `https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
}

export function formatDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Mensagem legível de erros do Supabase (PostgrestError nem sempre é instanceof Error). */
/** Erros técnicos comuns (Supabase, rede) traduzidos para quem usa o painel. */
const TRADUCOES_ERRO: [RegExp, string][] = [
  [/failed to fetch|networkerror|network request failed|load failed|fetch failed/i, "Sem conexão com o servidor. Verifique sua internet e tente de novo."],
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Este e-mail ainda não foi confirmado."],
  [/user already registered|already been registered/i, "Já existe uma conta com este e-mail."],
  [/should be different from the old password/i, "A nova senha precisa ser diferente da atual."],
  [/password should be at least/i, "A senha precisa ter pelo menos 6 caracteres."],
  [/jwt expired|invalid jwt|session.*(expired|missing)|refresh token/i, "Sua sessão expirou. Entre novamente."],
  [/rate limit|too many requests|security purposes/i, "Muitas tentativas seguidas. Aguarde um pouco e tente de novo."],
  [/row-level security|permission denied|not authorized|unauthorized/i, "Você não tem permissão para fazer isso."],
  [/duplicate key|already exists|23505/i, "Esse registro já existe."],
  [/violates foreign key|23503/i, "Este item está ligado a outros registros e não pode ser alterado assim."],
  [/violates check constraint|23514|invalid input syntax|22P02|22007|22008/i, "Algum dado foi preenchido em formato inválido. Confira os campos."],
  [/schema cache|does not exist|PGRST20[45]|42P01|42703|could not find the (table|function|column)/i, "Este recurso ainda não está disponível. Avise o responsável técnico pelo painel."],
  [/payload too large|entity too large|exceeded the maximum allowed size/i, "O arquivo é grande demais."],
  [/timeout|timed out/i, "O servidor demorou para responder. Tente de novo."],
  [/unexpected token|is not valid json|unexpected end of json/i, "Não foi possível ler os dados recebidos."],
];

/**
 * Mensagem para mostrar ao usuário. Mensagens nossas (em português) passam direto;
 * erros técnicos conhecidos são traduzidos e o original vai para o console.
 */
export function mensagemErro(err: unknown, padrao = "Ocorreu um erro") {
  const original =
    err && typeof err === "object" && "message" in err && typeof err.message === "string"
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const codigo = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  if (!original && !codigo) return padrao;
  const texto = `${original} ${codigo}`;
  const traducao = TRADUCOES_ERRO.find(([re]) => re.test(texto));
  if (traducao) {
    console.warn("[detalhe técnico]", err);
    return traducao[1];
  }
  return original || padrao;
}
