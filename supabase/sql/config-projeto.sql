-- =====================================================================
-- SETEC • Endereço do projeto Supabase usado pelo banco
-- Pode ser executado mais de uma vez com segurança (idempotente).
-- Rode ANTES de minicursos-email.sql e de limpeza-imagens.sql.
--
-- O banco chama as Edge Functions (e-mail de confirmação e limpeza de
-- imagens) pela URL do projeto. Para não deixar essa URL no repositório,
-- ela fica guardada no Vault do Supabase com o nome "setec_project_url".
--
-- Cadastre a URL UMA vez, no SQL Editor (não salve no repositório):
--
--   select vault.create_secret('https://SEU-PROJETO.supabase.co', 'setec_project_url');
--
-- Para trocar depois:
--
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'setec_project_url'),
--     'https://NOVO-PROJETO.supabase.co'
--   );
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- URL completa de uma Edge Function (null se o segredo não foi cadastrado)
CREATE OR REPLACE FUNCTION public.setec_edge_function_url(_funcao text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT rtrim(decrypted_secret, '/') || '/functions/v1/' || _funcao
    FROM vault.decrypted_secrets
   WHERE name = 'setec_project_url'
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.setec_edge_function_url(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setec_edge_function_url(text) TO service_role;

-- Conferência: deve mostrar a URL da função (e não null)
SELECT public.setec_edge_function_url('confirmar-inscricao') AS url_confirmar_inscricao;
