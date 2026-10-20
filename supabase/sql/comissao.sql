-- =====================================================================
-- SETEC • Tabela da comissão organizadora
-- Pode ser executado mais de uma vez com segurança (idempotente).
-- Rode ANTES de comissao-semestres.sql e de master-recursos.sql.
--
-- Depende de: public.is_active_user e public.set_updated_at (migrations).
-- Os grupos e semestres permitidos são definidos em comissao-semestres.sql.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.comissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  grupo text NOT NULL,
  email text,
  semestre smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- O site público lê pela view comissao_publica; a tabela só é acessada pelo painel
ALTER TABLE public.comissao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comissao admin write" ON public.comissao;
CREATE POLICY "comissao admin write" ON public.comissao
  FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

DROP TRIGGER IF EXISTS comissao_updated ON public.comissao;
CREATE TRIGGER comissao_updated
  BEFORE UPDATE ON public.comissao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';
