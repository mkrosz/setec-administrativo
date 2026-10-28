import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, HelpCircle, Trash2 } from "lucide-react";

type Tom = "perigo" | "aviso" | "neutro";

export type OpcoesConfirmar = {
  titulo: string;
  descricao?: ReactNode;
  confirmar?: string;
  cancelar?: string;
  tom?: Tom;
};

const ESTILO: Record<Tom, { icone: typeof AlertTriangle; caixa: string; botao: string }> = {
  perigo: {
    icone: Trash2,
    caixa: "bg-destructive/15 text-destructive",
    botao: "bg-destructive text-white hover:bg-destructive/90",
  },
  aviso: {
    icone: AlertTriangle,
    caixa: "bg-amber-500/15 text-amber-500",
    botao: "bg-primary text-primary-foreground hover:bg-primary-glow",
  },
  neutro: {
    icone: HelpCircle,
    caixa: "bg-primary/15 text-primary-glow",
    botao: "bg-primary text-primary-foreground hover:bg-primary-glow",
  },
};

/**
 * Confirmação no visual do painel (substitui o window.confirm do navegador).
 * Uso: const [dialogo, confirmar] = useConfirmar();  →  if (await confirmar({...})) ...
 * e renderize {dialogo} no componente.
 */
export function useConfirmar() {
  const [opcoes, setOpcoes] = useState<OpcoesConfirmar | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirmar = useCallback((o: OpcoesConfirmar) => {
    setOpcoes(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const responder = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpcoes(null);
  };

  const tom = opcoes?.tom ?? "neutro";
  const { icone: Icone, caixa, botao } = ESTILO[tom];

  const dialogo = (
    <Dialog.Root open={!!opcoes} onOpenChange={(v) => !v && responder(false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[26px] border border-border/60 bg-card p-6 shadow-[0_40px_90px_-20px_rgba(0,0,0,0.85)]">
          <div className="flex items-start gap-4">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${caixa}`}
            >
              <Icone className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <Dialog.Title className="font-display text-lg font-bold text-foreground">
                {opcoes?.titulo}
              </Dialog.Title>
              {opcoes?.descricao && (
                <Dialog.Description asChild>
                  <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {opcoes.descricao}
                  </div>
                </Dialog.Description>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => responder(false)}
              className="flex h-10 items-center justify-center rounded-full border border-border/70 px-5 text-sm font-medium text-foreground transition-colors hover:border-primary/60"
            >
              {opcoes?.cancelar ?? "Cancelar"}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => responder(true)}
              className={`flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors ${botao}`}
            >
              {opcoes?.confirmar ?? "Confirmar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  return [dialogo, confirmar] as const;
}
