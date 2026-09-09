import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  pagina: number;
  totalPaginas: number;
  onChange: (p: number) => void;
};

export function Paginacao({ pagina, totalPaginas, onChange }: Props) {
  if (totalPaginas <= 1) return null;

  const btn =
    "flex h-8 min-w-8 items-center justify-center rounded-full border border-border/60 px-2 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:opacity-40";

  return (
    <div className="mt-5 flex items-center justify-center gap-2">
      <button className={btn} onClick={() => onChange(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={
            n === pagina
              ? "flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 text-xs font-medium text-primary-foreground"
              : btn
          }
        >
          {n}
        </button>
      ))}
      <button
        className={btn}
        onClick={() => onChange(pagina + 1)}
        disabled={pagina >= totalPaginas}
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
