/**
 * Observabilidade in-repo: logs estruturados (JSON), métricas de requisição
 * e checagem de disponibilidade via /healthz e /metrics.
 * Não depende de contas externas (Sentry, UptimeRobot etc.).
 */

export type NivelLog = "info" | "warn" | "error";

export type EventoLog = {
  ts: string;
  nivel: NivelLog;
  tipo: string;
  mensagem: string;
  dados?: Record<string, unknown>;
};

export type MetricaRequisicao = {
  metodo: string;
  caminho: string;
  status: number;
  duracaoMs: number;
};

type AgregadoRota = {
  requisicoes: number;
  erros: number;
  duracaoTotalMs: number;
  duracaoMaxMs: number;
};

const inicioProcesso = Date.now();
let totalRequisicoes = 0;
let totalErros = 0;
let duracaoTotalMs = 0;
const porRota = new Map<string, AgregadoRota>();
const ultimosErros: EventoLog[] = [];
const MAX_ERROS = 50;

function agoraIso() {
  return new Date().toISOString();
}

function chaveRota(metodo: string, caminho: string) {
  return `${metodo.toUpperCase()} ${caminho}`;
}

/** Caminho sem query string, limitado para não explodir cardinalidade. */
export function normalizarCaminho(url: string): string {
  try {
    const u = new URL(url, "http://localhost");
    let path = u.pathname || "/";
    // Tokens/UUID viram placeholder para agrupar métricas.
    path = path.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ":id",
    );
    if (path.length > 120) path = `${path.slice(0, 117)}...`;
    return path;
  } catch {
    return "/";
  }
}

export function logEvento(
  nivel: NivelLog,
  tipo: string,
  mensagem: string,
  dados?: Record<string, unknown>,
): EventoLog {
  const evento: EventoLog = {
    ts: agoraIso(),
    nivel,
    tipo,
    mensagem,
    ...(dados ? { dados } : {}),
  };
  const linha = JSON.stringify(evento);
  if (nivel === "error") {
    console.error(linha);
    ultimosErros.push(evento);
    if (ultimosErros.length > MAX_ERROS) ultimosErros.shift();
  } else if (nivel === "warn") {
    console.warn(linha);
  } else {
    console.info(linha);
  }
  return evento;
}

export function logErro(
  tipo: string,
  erro: unknown,
  dados?: Record<string, unknown>,
): EventoLog {
  const mensagem =
    erro instanceof Error
      ? erro.message
      : typeof erro === "string"
        ? erro
        : "erro desconhecido";
  return logEvento("error", tipo, mensagem, {
    ...dados,
    nome: erro instanceof Error ? erro.name : undefined,
  });
}

export function registrarRequisicao(m: MetricaRequisicao) {
  totalRequisicoes += 1;
  duracaoTotalMs += m.duracaoMs;
  if (m.status >= 500) totalErros += 1;

  const chave = chaveRota(m.metodo, m.caminho);
  const atual = porRota.get(chave) ?? {
    requisicoes: 0,
    erros: 0,
    duracaoTotalMs: 0,
    duracaoMaxMs: 0,
  };
  atual.requisicoes += 1;
  atual.duracaoTotalMs += m.duracaoMs;
  atual.duracaoMaxMs = Math.max(atual.duracaoMaxMs, m.duracaoMs);
  if (m.status >= 500) atual.erros += 1;
  porRota.set(chave, atual);

  logEvento(m.status >= 500 ? "error" : "info", "http.request", `${m.metodo} ${m.caminho}`, {
    status: m.status,
    duracao_ms: m.duracaoMs,
  });
}

export function snapshotMetricas() {
  const rotas = [...porRota.entries()]
    .map(([rota, a]) => ({
      rota,
      requisicoes: a.requisicoes,
      erros: a.erros,
      duracao_media_ms:
        a.requisicoes > 0 ? Math.round(a.duracaoTotalMs / a.requisicoes) : 0,
      duracao_max_ms: a.duracaoMaxMs,
    }))
    .sort((a, b) => b.requisicoes - a.requisicoes);

  return {
    ok: true,
    uptime_s: Math.round((Date.now() - inicioProcesso) / 1000),
    requisicoes: totalRequisicoes,
    erros: totalErros,
    taxa_erro:
      totalRequisicoes > 0
        ? Number((totalErros / totalRequisicoes).toFixed(4))
        : 0,
    duracao_media_ms:
      totalRequisicoes > 0 ? Math.round(duracaoTotalMs / totalRequisicoes) : 0,
    rotas,
    ultimos_erros: ultimosErros.slice(-10),
  };
}

export function statusSaude() {
  return {
    status: "ok" as const,
    ts: agoraIso(),
    uptime_s: Math.round((Date.now() - inicioProcesso) / 1000),
  };
}

/** Zera contadores — só para testes. */
export function resetMetricasParaTestes() {
  totalRequisicoes = 0;
  totalErros = 0;
  duracaoTotalMs = 0;
  porRota.clear();
  ultimosErros.length = 0;
}
