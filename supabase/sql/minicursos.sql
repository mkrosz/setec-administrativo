-- =====================================================================
-- SETEC • Minicursos com inscrição pelo site público e controle de vagas
-- Pode ser executado mais de uma vez com segurança (idempotente).
-- Depende de: public.is_active_user, public.set_updated_at e
-- public.presenca_turmas (criada em presenca.sql).
-- =====================================================================

-- Minicursos (mesmos campos das palestras + número de vagas).
-- "ministrantes" segue o formato de palestras.palestrantes:
--   [{ "nome": text, "cargo": text|null, "foto_url": text|null, "sobre": text|null }]
CREATE TABLE IF NOT EXISTS public.minicursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL DEFAULT '',
  ministrantes jsonb NOT NULL DEFAULT '[]'::jsonb,
  categoria text,
  data date,
  hora_inicio time,
  hora_fim time,
  local text,
  sobre text,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  vagas integer NOT NULL DEFAULT 30,
  rascunho boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.minicursos DROP CONSTRAINT IF EXISTS minicursos_ministrantes_array;
ALTER TABLE public.minicursos
  ADD CONSTRAINT minicursos_ministrantes_array CHECK (jsonb_typeof(ministrantes) = 'array');
ALTER TABLE public.minicursos DROP CONSTRAINT IF EXISTS minicursos_vagas_check;
ALTER TABLE public.minicursos
  ADD CONSTRAINT minicursos_vagas_check CHECK (vagas BETWEEN 1 AND 10000);

DROP TRIGGER IF EXISTS minicursos_updated ON public.minicursos;
CREATE TRIGGER minicursos_updated
  BEFORE UPDATE ON public.minicursos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Inscrições (pelo site ou adicionadas manualmente no painel).
CREATE TABLE IF NOT EXISTS public.minicurso_inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minicurso_id uuid NOT NULL REFERENCES public.minicursos(id) ON DELETE CASCADE,
  nome_completo text NOT NULL CHECK (char_length(btrim(nome_completo)) BETWEEN 3 AND 160),
  ra text NOT NULL CHECK (ra ~ '^[0-9]{5,20}$'),
  email text NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND char_length(email) <= 160),
  turma text NOT NULL CHECK (char_length(btrim(turma)) BETWEEN 1 AND 60),
  origem text NOT NULL DEFAULT 'site' CHECK (origem IN ('site', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT minicurso_inscricoes_ra_unique UNIQUE (minicurso_id, ra)
);
CREATE INDEX IF NOT EXISTS minicurso_inscricoes_minicurso_idx
  ON public.minicurso_inscricoes (minicurso_id);

-- Acesso: o público lê só minicursos publicados; inscrições só pelo painel
-- (o público usa as funções abaixo, que não expõem dados dos inscritos).
REVOKE ALL ON public.minicursos FROM anon;
REVOKE ALL ON public.minicurso_inscricoes FROM anon;
GRANT SELECT ON public.minicursos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.minicursos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.minicurso_inscricoes TO authenticated;
GRANT ALL ON public.minicursos TO service_role;
GRANT ALL ON public.minicurso_inscricoes TO service_role;

ALTER TABLE public.minicursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minicurso_inscricoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "minicursos leitura publica" ON public.minicursos;
CREATE POLICY "minicursos leitura publica" ON public.minicursos
  FOR SELECT TO anon
  USING (NOT rascunho);

DROP POLICY IF EXISTS "minicursos painel" ON public.minicursos;
CREATE POLICY "minicursos painel" ON public.minicursos
  FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "minicurso_inscricoes painel" ON public.minicurso_inscricoes;
CREATE POLICY "minicurso_inscricoes painel" ON public.minicurso_inscricoes
  FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

-- Vagas e total de inscritos de cada minicurso publicado (sem dados pessoais).
CREATE OR REPLACE FUNCTION public.minicursos_vagas()
RETURNS TABLE (minicurso_id uuid, vagas integer, inscritos integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.vagas, count(i.id)::integer
  FROM public.minicursos m
  LEFT JOIN public.minicurso_inscricoes i ON i.minicurso_id = m.id
  WHERE NOT m.rascunho
  GROUP BY m.id, m.vagas
$$;

-- Inscrição pelo site. Trava a linha do minicurso para que duas pessoas
-- não fiquem com a última vaga ao mesmo tempo. Retorna as vagas restantes.
CREATE OR REPLACE FUNCTION public.inscrever_minicurso(
  _minicurso uuid,
  _nome text,
  _ra text,
  _email text,
  _turma text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mc public.minicursos%ROWTYPE;
  v_nome text := btrim(regexp_replace(coalesce(_nome, ''), '\s+', ' ', 'g'));
  v_ra text := regexp_replace(coalesce(_ra, ''), '\D', '', 'g');
  v_email text := lower(btrim(coalesce(_email, '')));
  v_turma text := btrim(coalesce(_turma, ''));
  v_total integer;
  v_id uuid;
BEGIN
  SELECT * INTO v_mc FROM public.minicursos WHERE id = _minicurso AND NOT rascunho FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Minicurso não encontrado.';
  END IF;
  IF v_mc.data IS NOT NULL
     AND (v_mc.data + coalesce(v_mc.hora_inicio, time '00:00')) <= (now() AT TIME ZONE 'America/Sao_Paulo') THEN
    RAISE EXCEPTION 'As inscrições para este minicurso foram encerradas.';
  END IF;
  IF char_length(v_nome) < 3 OR position(' ' IN v_nome) = 0 THEN
    RAISE EXCEPTION 'Informe seu nome completo.';
  END IF;
  IF v_ra !~ '^[0-9]{5,20}$' THEN
    RAISE EXCEPTION 'RA inválido. Use apenas números.';
  END IF;
  IF v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR char_length(v_email) > 160 THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;
  IF v_turma <> 'N/A' AND NOT EXISTS (SELECT 1 FROM public.presenca_turmas WHERE nome = v_turma) THEN
    RAISE EXCEPTION 'Selecione a sua turma.';
  END IF;

  SELECT count(*) INTO v_total FROM public.minicurso_inscricoes WHERE minicurso_id = v_mc.id;
  IF EXISTS (SELECT 1 FROM public.minicurso_inscricoes WHERE minicurso_id = v_mc.id AND ra = v_ra) THEN
    RAISE EXCEPTION 'Este RA já está inscrito neste minicurso.';
  END IF;
  IF v_total >= v_mc.vagas THEN
    RAISE EXCEPTION 'As vagas deste minicurso estão esgotadas.';
  END IF;

  INSERT INTO public.minicurso_inscricoes (minicurso_id, nome_completo, ra, email, turma, origem)
  VALUES (v_mc.id, left(v_nome, 160), v_ra, v_email, v_turma, 'site')
  ON CONFLICT (minicurso_id, ra) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Este RA já está inscrito neste minicurso.';
  END IF;
  RETURN v_mc.vagas - v_total - 1;
END;
$$;

REVOKE ALL ON FUNCTION public.minicursos_vagas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inscrever_minicurso(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.minicursos_vagas() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inscrever_minicurso(uuid, text, text, text, text) TO anon, authenticated, service_role;

-- Faz a API do Supabase enxergar as novas tabelas/funções imediatamente.
NOTIFY pgrst, 'reload schema';
