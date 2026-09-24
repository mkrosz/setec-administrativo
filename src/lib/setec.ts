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

export type Palestra = {
  id: string;
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
  created_at: string;
  updated_at: string;
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