-- =====================================================================
-- SETEC • E-mail de confirmação de inscrição em minicurso
-- Rode DEPOIS de minicursos.sql, de config-projeto.sql (URL do projeto no
-- Vault) e de publicar a Edge Function "confirmar-inscricao"
-- (supabase/functions/confirmar-inscricao).
-- Pode ser executado mais de uma vez com segurança (idempotente).
--
-- A cada nova inscrição (pelo site ou manual no painel) o banco chama a
-- Edge Function, que envia o e-mail e grava o resultado nas colunas abaixo.
-- =====================================================================

-- Resultado do envio (o painel mostra e permite reenviar)
ALTER TABLE public.minicurso_inscricoes ADD COLUMN IF NOT EXISTS email_enviado_em timestamptz;
ALTER TABLE public.minicurso_inscricoes ADD COLUMN IF NOT EXISTS email_erro text;

-- Extensão de requisições HTTP do Supabase
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Chama a Edge Function com o id da inscrição. A função busca os dados no
-- banco e só envia para inscrições reais ainda sem e-mail enviado.
CREATE OR REPLACE FUNCTION public.minicurso_inscricao_enviar_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM net.http_post(
    url := public.setec_edge_function_url('confirmar-inscricao'),
    body := jsonb_build_object('id', NEW.id),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca impede a inscrição por causa do e-mail
  RAISE WARNING 'Falha ao chamar confirmar-inscricao: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS minicurso_inscricoes_email ON public.minicurso_inscricoes;
CREATE TRIGGER minicurso_inscricoes_email
  AFTER INSERT ON public.minicurso_inscricoes
  FOR EACH ROW EXECUTE FUNCTION public.minicurso_inscricao_enviar_email();

REVOKE ALL ON FUNCTION public.minicurso_inscricao_enviar_email() FROM PUBLIC, anon, authenticated;

-- Reenvio pelo painel: limpa o status e chama a função de novo
CREATE OR REPLACE FUNCTION public.reenviar_email_inscricao(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  UPDATE public.minicurso_inscricoes
     SET email_enviado_em = NULL, email_erro = NULL
   WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inscrição não encontrada.';
  END IF;
  IF public.setec_edge_function_url('confirmar-inscricao') IS NULL THEN
    RAISE EXCEPTION 'URL do projeto não configurada (rode config-projeto.sql).';
  END IF;
  PERFORM net.http_post(
    url := public.setec_edge_function_url('confirmar-inscricao'),
    body := jsonb_build_object('id', _id),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reenviar_email_inscricao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reenviar_email_inscricao(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
