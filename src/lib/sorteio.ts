import type { Presenca } from "@/lib/setec";

/** Quem está na roleta: aluno da chamada ou nome incluído só para o sorteio. */
export type Participante = {
  id: string;
  nome: string;
  /** Turma da chamada (ex.: "4º ano") ou "ano · curso" de quem foi incluído à mão. */
  detalhe: string;
  origem: "presenca" | "manual";
};

/** Incluído direto na roleta: não entra na lista de presença. */
export type ParticipanteManual = {
  id: string;
  nome: string;
  ano: string;
  curso: string;
};

/** Cores dos gomos: tons da identidade visual da SETEC (ametista, violeta e índigo). */
export const CORES_ROLETA = [
  "oklch(0.53 0.17 292)",
  "oklch(0.40 0.14 278)",
  "oklch(0.62 0.19 305)",
  "oklch(0.34 0.11 268)",
  "oklch(0.57 0.18 322)",
  "oklch(0.46 0.17 258)",
] as const;

/** Cor do gomo i; com número ímpar de gomos, o último não repete a cor do primeiro. */
export function corDoGomo(indice: number, total: number) {
  const n = CORES_ROLETA.length;
  const ultimoIgualAoPrimeiro = total > 1 && (total - 1) % n === 0;
  if (ultimoIgualAoPrimeiro && indice === total - 1) return CORES_ROLETA[2];
  return CORES_ROLETA[indice % n];
}

/** Alunos da chamada de uma palestra, em ordem alfabética e sem RA repetido. */
export function participantesDaChamada(presencas: Presenca[]): Participante[] {
  const vistos = new Set<string>();
  const lista: Participante[] = [];
  for (const p of presencas) {
    const chave = p.ra?.trim() || p.id;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push({
      id: p.id,
      nome: p.nome_completo.trim(),
      detalhe: p.ano_turma || "",
      origem: "presenca",
    });
  }
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function participanteManual(m: ParticipanteManual): Participante {
  return {
    id: m.id,
    nome: m.nome,
    detalhe: [m.ano, m.curso].filter(Boolean).join(" · "),
    origem: "manual",
  };
}

/** Valida e limpa os campos do formulário; devolve a mensagem de erro, se houver. */
export function novoParticipanteManual(
  campos: { nome: string; ano: string; curso: string },
  id: string,
): ParticipanteManual | string {
  const nome = campos.nome.trim().replace(/\s+/g, " ");
  if (nome.length < 2) return "Informe o nome do aluno.";
  return { id: `manual-${id}`, nome, ano: campos.ano.trim(), curso: campos.curso.trim() };
}

/** Nome curto para caber no gomo: primeiro e último nome. */
export function nomeCurto(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return partes.join(" ");
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

/** Ângulo (graus) de cada gomo. */
export function anguloDoGomo(total: number) {
  return total > 0 ? 360 / total : 360;
}

/**
 * Nova rotação da roleta para o gomo `indice` parar na seta (lado esquerdo, 180°).
 * Os gomos começam em 0° (direita) e seguem no sentido horário.
 * `desvio` (de -0.5 a 0.5) evita parar sempre no meio do gomo.
 */
export function rotacaoFinal(
  rotacaoAtual: number,
  indice: number,
  total: number,
  voltas = 6,
  desvio = 0,
) {
  const gomo = anguloDoGomo(total);
  const centro = (indice + 0.5 + desvio * 0.7) * gomo;
  const alvo = (((180 - centro) % 360) + 360) % 360;
  const atual = ((rotacaoAtual % 360) + 360) % 360;
  const falta = (alvo - atual + 360) % 360;
  return rotacaoAtual + voltas * 360 + falta;
}

/** Qual gomo está na seta para uma rotação qualquer. */
export function gomoNaSeta(rotacao: number, total: number) {
  if (total <= 0) return -1;
  const gomo = anguloDoGomo(total);
  const angulo = (((180 - rotacao) % 360) + 360) % 360;
  return Math.min(total - 1, Math.floor(angulo / gomo));
}

/** Índice sorteado com crypto (mais justo que Math.random). */
export function sortearIndice(total: number, aleatorio: () => number = numeroAleatorio) {
  if (total <= 0) throw new Error("Não há ninguém na roleta.");
  return Math.min(total - 1, Math.floor(aleatorio() * total));
}

function numeroAleatorio() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 2 ** 32;
}
