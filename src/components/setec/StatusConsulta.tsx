import { AlertTriangle, Loader2, RotateCw } from "lucide-react";

import { mensagemErro } from "@/lib/setec";

type Consulta = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
};

/**
 * Mostra "carregando" ou o erro de uma consulta dentro de uma seção do painel.
 * Quando a consulta está ok, não renderiza nada (a seção mostra os dados ou o estado vazio).
 */
export function StatusConsulta({ consulta, nome }: { consulta: Consulta; nome: string }) {
  if (consulta.isLoading) {
    return (
      <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando {nome}…
      </p>
    );
  }
  if (consulta.isError) {
    return (
      <div
        role="alert"
        className="my-3 flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-foreground"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        <span className="min-w-0 flex-1">
          Não foi possível carregar {nome}.{" "}
          <span className="text-muted-foreground">{mensagemErro(consulta.error, "Tente novamente.")}</span>
        </span>
        <button
          type="button"
          onClick={() => consulta.refetch()}
          className="flex h-8 items-center gap-1.5 rounded-full border border-border/70 px-3 text-xs font-medium transition-colors hover:border-primary/60"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      </div>
    );
  }
  return null;
}
