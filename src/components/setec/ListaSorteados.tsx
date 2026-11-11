import { RotateCcw, Trophy, Undo2 } from "lucide-react";

import type { Participante } from "@/lib/sorteio";

type Props = {
  sorteados: Participante[];
  girando: boolean;
  onDevolver: (participante: Participante) => void;
  onReiniciar: () => void;
};

/** Sorteados em ordem, com opção de devolver um nome à roleta ou recomeçar. */
export function ListaSorteados({ sorteados, girando, onDevolver, onReiniciar }: Props) {
  return (
    <section className="panel-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Trophy className="h-4 w-4 text-primary-glow" />
          Sorteados
        </h2>
        <button
          onClick={onReiniciar}
          disabled={sorteados.length === 0 || girando}
          className="flex h-8 items-center justify-center gap-2 rounded-full border border-border/70 px-3 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reiniciar
        </button>
      </div>
      {sorteados.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Ninguém sorteado ainda.</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {sorteados.map((s, i) => {
            const detalhe = [s.detalhe, s.origem === "manual" ? "incluído no sorteio" : ""]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold tabular-nums text-primary-glow">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{s.nome}</span>
                  {detalhe && (
                    <span className="block truncate text-xs text-muted-foreground">{detalhe}</span>
                  )}
                </span>
                <button
                  onClick={() => onDevolver(s)}
                  disabled={girando}
                  aria-label={`Devolver ${s.nome} à roleta`}
                  title="Devolver à roleta"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
