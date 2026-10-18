-- =====================================================================
-- SETEC • Comissão: cursos semestrais da manhã (1º–6º) e da noite (1º–8º)
-- Pode ser executado mais de uma vez com segurança (idempotente).
--
-- Grupos: 'professor', '5ano', '4ano' (sem semestre)
--         'manha' (semestre 1 a 6) e 'noite' (semestre 1 a 8)
-- =====================================================================

-- A view pública depende da coluna "grupo"; é recriada no fim.
DROP VIEW IF EXISTS public.comissao_publica;

-- Remove as regras antigas de "grupo" (qualquer CHECK que cite a coluna)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.comissao'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%grupo%'
  LOOP
    EXECUTE format('ALTER TABLE public.comissao DROP CONSTRAINT %I', r.conname);
  END LOOP;
END;
$$;

-- Garante que "grupo" seja texto (caso tenha sido criado como enum)
ALTER TABLE public.comissao ALTER COLUMN grupo TYPE text USING grupo::text;

ALTER TABLE public.comissao ADD COLUMN IF NOT EXISTS semestre smallint;

ALTER TABLE public.comissao
  ADD CONSTRAINT comissao_grupo_semestre_check CHECK (
    (grupo IN ('professor', '5ano', '4ano') AND semestre IS NULL)
    OR (grupo = 'manha' AND semestre BETWEEN 1 AND 6)
    OR (grupo = 'noite' AND semestre BETWEEN 1 AND 8)
  );

-- View lida pelo site público (agora com o semestre)
CREATE VIEW public.comissao_publica AS
  SELECT id, nome, email, grupo, semestre
    FROM public.comissao;

GRANT SELECT ON public.comissao_publica TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
