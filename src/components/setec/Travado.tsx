import { createContext, useContext, type ReactNode } from "react";

/** true quando o painel está congelado para quem está logado (sem acesso total). */
export const CongeladoContext = createContext(false);

export function usePainelCongelado() {
  return useContext(CongeladoContext);
}

/**
 * Envolve controles de edição: com o painel congelado eles ficam escuros e não respondem a
 * clique, teclado nem foco (inert). Não cria caixa no layout (display: contents).
 */
export function Travado({ children, ativo }: { children: ReactNode; ativo?: boolean }) {
  const congelado = usePainelCongelado();
  if (!(ativo ?? congelado)) return <>{children}</>;
  return (
    <div className="painel-travado" inert title="Painel congelado pela conta master">
      {children}
    </div>
  );
}
