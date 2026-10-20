-- =====================================================================
-- SETEC • Limpeza automática de imagens sem uso (12 meses)
-- Rode DEPOIS de config-projeto.sql (URL do projeto no Vault) e de publicar
-- a Edge Function "limpar-imagens" (supabase/functions/limpar-imagens),
-- com "Verify JWT" desativado.
-- Pode ser executado mais de uma vez com segurança (idempotente).
--
-- Todo dia a função compara os arquivos do bucket "setec-bucket" com as
-- imagens usadas por palestras, minicursos, apoiadores e logo do evento.
-- Imagem sem uso entra em "storage_imagens_orfas" com a data; se voltar a
-- ser usada, sai da lista. Só é apagada após 12 meses seguidos sem uso.
-- Apenas as pastas criadas pelo painel são consideradas:
--   palestrantes/, ministrantes/, patrocinadores/, evento/
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Imagens sem uso e desde quando
CREATE TABLE IF NOT EXISTS public.storage_imagens_orfas (
  caminho text PRIMARY KEY,
  orfa_desde timestamptz NOT NULL DEFAULT now()
);

-- Só a Edge Function (service role) acessa
ALTER TABLE public.storage_imagens_orfas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_imagens_orfas FROM anon, authenticated;
GRANT ALL ON public.storage_imagens_orfas TO service_role;

-- Arquivos das pastas do painel no bucket (lido pela Edge Function)
CREATE OR REPLACE FUNCTION public.storage_objetos_setec()
RETURNS TABLE (caminho text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT o.name
    FROM storage.objects o
   WHERE o.bucket_id = 'setec-bucket'
     AND o.name ~ '^(palestrantes|ministrantes|patrocinadores|evento)/'
     AND o.name NOT LIKE '%.emptyFolderPlaceholder'
$$;

REVOKE ALL ON FUNCTION public.storage_objetos_setec() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_objetos_setec() TO service_role;

-- Agendamento diário (03:30 em Brasília = 06:30 UTC); recria se já existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'setec-limpar-imagens') THEN
    PERFORM cron.unschedule('setec-limpar-imagens');
  END IF;
END;
$$;

SELECT cron.schedule(
  'setec-limpar-imagens',
  '30 6 * * *',
  $$
    SELECT net.http_post(
      url := public.setec_edge_function_url('limpar-imagens'),
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 60000
    );
  $$
);

NOTIFY pgrst, 'reload schema';
