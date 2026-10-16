import { supabase } from "@/integrations/supabase/client";
import type { Presenca } from "@/lib/setec";

export type Posicao = { latitude: number; longitude: number; precisao: number };

/** Pede a posição atual ao navegador (GPS do celular ou localização do computador). */
export function obterPosicao(): Promise<Posicao> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Seu navegador não permite obter a localização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisao: pos.coords.accuracy,
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Permita o acesso à localização nas configurações do navegador."
              : "Não foi possível obter a localização. Verifique se o GPS está ligado.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

type EnderecoNominatim = Partial<
  Record<
    | "amenity"
    | "university"
    | "college"
    | "school"
    | "building"
    | "road"
    | "house_number"
    | "suburb"
    | "neighbourhood"
    | "quarter"
    | "city"
    | "town"
    | "village"
    | "municipality"
    | "ISO3166-2-lvl4",
    string
  >
>;

function montarNome(dados: { name?: string; address?: EnderecoNominatim }) {
  const a = dados.address ?? {};
  const lugar = dados.name || a.amenity || a.university || a.college || a.school || a.building;
  const rua = [a.road, a.house_number].filter(Boolean).join(", ");
  const bairro = a.suburb || a.neighbourhood || a.quarter;
  const cidade = a.city || a.town || a.village || a.municipality;
  const uf = a["ISO3166-2-lvl4"]?.split("-")[1];
  const partes = [lugar, rua, bairro, cidade && (uf ? `${cidade} - ${uf}` : cidade)].filter(
    (p): p is string => !!p,
  );
  return Array.from(new Set(partes)).join(", ") || null;
}

// Coordenadas próximas (~10 m) compartilham o mesmo nome: a sala inteira vira 1 consulta.
const cache = new Map<string, Promise<string | null>>();
let fila: Promise<unknown> = Promise.resolve();

function chave(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/** Converte coordenadas no nome do local (OpenStreetMap), respeitando 1 consulta/segundo. */
export function nomeDoLocal(lat: number, lng: number): Promise<string | null> {
  const k = chave(lat, lng);
  const existente = cache.get(k);
  if (existente) return existente;

  const tarefa = fila.then(async () => {
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1` +
        `&accept-language=pt-BR&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      return montarNome(await res.json());
    } catch {
      return null;
    } finally {
      await new Promise((r) => setTimeout(r, 1100));
    }
  });
  fila = tarefa;
  cache.set(k, tarefa);
  // Falhas não ficam no cache, para tentar de novo depois
  tarefa.then((nome) => nome ?? cache.delete(k));
  return tarefa;
}

/**
 * Preenche o nome do local das presenças que só têm coordenadas e salva no banco.
 * Retorna um mapa id → nome do local com as que foram atualizadas.
 */
export async function resolverLocaisPendentes(presencas: Presenca[]) {
  const pendentes = presencas.filter(
    (p) => !p.localizacao && p.latitude != null && p.longitude != null,
  );
  const atualizadas = new Map<string, string>();
  for (const p of pendentes) {
    const nome = await nomeDoLocal(p.latitude!, p.longitude!);
    if (!nome) continue;
    const { error } = await supabase
      .from("presencas" as any)
      .update({ localizacao: nome } as any)
      .eq("id", p.id);
    if (!error) atualizadas.set(p.id, nome);
  }
  return atualizadas;
}
