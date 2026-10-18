import type { QueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

let ultimaVerificacao = 0;
let emAndamento: Promise<void> | null = null;

/**
 * Pede à Edge Function "verificar-devolucoes" para ler as devoluções de e-mail na caixa do Gmail
 * da SETEC e, ao terminar, atualiza a lista de inscritos (o ✗ aparece em quem teve o e-mail devolvido).
 * Chamada ao abrir o painel e ao abrir a lista de inscritos; no máximo uma vez a cada 30 segundos.
 * Falhas são silenciosas (ex.: função ainda não publicada).
 */
export function verificarDevolucoes(queryClient: QueryClient) {
  if (emAndamento) return emAndamento;
  if (Date.now() - ultimaVerificacao < 30_000) return Promise.resolve();
  ultimaVerificacao = Date.now();

  emAndamento = supabase.functions
    .invoke("verificar-devolucoes", { body: {} })
    .then(({ data }) => {
      if ((data as { inscricoesMarcadas?: number } | null)?.inscricoesMarcadas) {
        queryClient.invalidateQueries({ queryKey: ["minicurso_inscricoes"] });
      }
    })
    .catch(() => {})
    .finally(() => {
      emAndamento = null;
    });
  return emAndamento;
}
