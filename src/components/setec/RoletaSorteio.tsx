import { useEffect, useRef } from "react";

import { anguloDoGomo, corDoGomo, nomeCurto, type Participante } from "@/lib/sorteio";

const TAM = 500;
const C = TAM / 2;
const RAIO = 236;
const RAIO_MIOLO = 46;

/** Acima disso os nomes não cabem: os gomos mostram o número da lista. */
const MAX_NOMES = 36;

type Props = {
  participantes: Participante[];
  /** Rotação acumulada em graus (sentido horário). */
  rotacao: number;
  girando: boolean;
  duracaoMs: number;
  onFimDoGiro: () => void;
};

/** Arredondado: servidor e navegador calculam senos com diferenças na última casa (hidratação). */
function ponto(angulo: number, raio: number) {
  const rad = (angulo * Math.PI) / 180;
  const arred = (v: number) => Math.round(v * 100) / 100;
  return [arred(C + raio * Math.cos(rad)), arred(C + raio * Math.sin(rad))] as const;
}

function caminhoGomo(inicio: number, fim: number) {
  const [x0, y0] = ponto(inicio, RAIO);
  const [x1, y1] = ponto(fim, RAIO);
  const arcoGrande = fim - inicio > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x0} ${y0} A ${RAIO} ${RAIO} 0 ${arcoGrande} 1 ${x1} ${y1} Z`;
}

/** Roleta no estilo das rodas de sorteio, com as cores da SETEC e a seta à esquerda. */
export function RoletaSorteio({ participantes, rotacao, girando, duracaoMs, onFimDoGiro }: Props) {
  const total = participantes.length;
  const gomo = anguloDoGomo(total);
  const comNomes = total <= MAX_NOMES;
  const fonte = Math.max(9, Math.min(17, 340 / Math.max(total, 1)));

  // Avisa o fim do giro mesmo se a transição for pulada (aba em segundo plano, etc.).
  const fimRef = useRef(onFimDoGiro);
  fimRef.current = onFimDoGiro;
  useEffect(() => {
    if (!girando) return;
    const t = setTimeout(() => fimRef.current(), duracaoMs + 150);
    return () => clearTimeout(t);
  }, [girando, duracaoMs, rotacao]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[min(560px,100%)]">
      <svg
        viewBox={`0 0 ${TAM} ${TAM}`}
        className="h-full w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
        role="img"
        aria-label={`Roleta com ${total} participante(s)`}
      >
        {/* Aro */}
        <circle cx={C} cy={C} r={RAIO + 10} className="fill-card stroke-border" strokeWidth={2} />

        <g
          style={{
            transform: `rotate(${rotacao}deg)`,
            transformOrigin: `${C}px ${C}px`,
            transition: girando
              ? `transform ${duracaoMs}ms cubic-bezier(0.12, 0.72, 0.08, 1)`
              : "none",
          }}
        >
          {total === 0 && <circle cx={C} cy={C} r={RAIO} className="fill-field" />}
          {total === 1 && <circle cx={C} cy={C} r={RAIO} fill={corDoGomo(0, 1)} />}
          {total > 1 &&
            participantes.map((p, i) => (
              <path
                key={p.id}
                d={caminhoGomo(i * gomo, (i + 1) * gomo)}
                fill={corDoGomo(i, total)}
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={total > 60 ? 0.6 : 1.5}
              />
            ))}

          {/* Textos na direção do raio, lidos da borda para o centro: quem para na seta fica legível */}
          {participantes.map((p, i) => {
            const meio = (i + 0.5) * gomo;
            const texto = comNomes ? nomeCurto(p.nome) : String(i + 1);
            const max = comNomes ? 18 : 4;
            return (
              <text
                key={`t-${p.id}`}
                transform={`rotate(${meio + 180} ${C} ${C})`}
                x={C - RAIO + 16}
                y={C}
                textAnchor="start"
                dominantBaseline="central"
                fill="white"
                fontSize={total === 1 ? 22 : fonte}
                fontWeight={600}
                className="font-sans"
                style={{ paintOrder: "stroke" }}
                stroke="rgba(0,0,0,0.18)"
                strokeWidth={2}
              >
                {texto.length > max ? `${texto.slice(0, max - 1)}…` : texto}
              </text>
            );
          })}
        </g>

        {/* Miolo */}
        <circle cx={C} cy={C} r={RAIO_MIOLO + 6} className="fill-card" />
        <circle
          cx={C}
          cy={C}
          r={RAIO_MIOLO}
          className="fill-background stroke-primary"
          strokeWidth={3}
        />
        <text
          x={C}
          y={C}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground font-display"
          fontSize={15}
          fontWeight={900}
          letterSpacing={1}
        >
          SETEC
        </text>
      </svg>

      {/* Seta à esquerda, apontando para o gomo sorteado */}
      <svg
        viewBox="0 0 60 48"
        className="absolute left-0 top-1/2 w-[11%] -translate-x-[55%] -translate-y-1/2 drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]"
        aria-hidden="true"
      >
        <path
          d="M4 14 H34 V4 L58 24 L34 44 V34 H4 Z"
          className="fill-foreground stroke-primary"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
