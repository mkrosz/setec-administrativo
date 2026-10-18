-- =====================================================================
-- SETEC • Vários palestrantes por palestra
-- Pode ser executado mais de uma vez com segurança (idempotente).
--
-- Nova coluna palestras.palestrantes (jsonb): lista ordenada de objetos
--   { "nome": text, "cargo": text|null, "foto_url": text|null, "sobre": text|null }
--
-- As colunas antigas (nome_completo, cargo, sobre_palestrante, foto_url)
-- continuam existindo e são preenchidas automaticamente por um trigger a
-- partir de "palestrantes", para não quebrar quem ainda lê o formato antigo:
--   nome_completo     = nomes de todos, separados por ", "
--   cargo             = cargo do 1º palestrante
--   sobre_palestrante = bio do 1º palestrante
--   foto_url          = fotos de todos, na ordem
-- =====================================================================

ALTER TABLE public.palestras
  ADD COLUMN IF NOT EXISTS palestrantes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.palestras DROP CONSTRAINT IF EXISTS palestras_palestrantes_array;
ALTER TABLE public.palestras
  ADD CONSTRAINT palestras_palestrantes_array CHECK (jsonb_typeof(palestrantes) = 'array');

-- ---------------------------------------------------------------------
-- Migração dos dados atuais (só linhas que ainda não têm palestrantes).
--
-- Regra: se a palestra tem N fotos (N > 1) e o campo de nome lista
-- exatamente N nomes (separados por vírgula, ";", " e " ou " & "),
-- cada par nome/foto vira um palestrante (o cargo é copiado para todos
-- e a bio fica no 1º). Caso contrário, vira 1 palestrante com o nome,
-- cargo, bio e a 1ª foto; as fotos extras viram palestrantes sem nome,
-- para nenhuma foto se perder — o painel pede o nome antes de publicar.
-- ---------------------------------------------------------------------
WITH base AS (
  SELECT
    p.id,
    nullif(btrim(p.nome_completo), '') AS nome,
    nullif(btrim(p.cargo), '') AS cargo,
    nullif(btrim(p.sobre_palestrante), '') AS sobre,
    coalesce(
      (SELECT array_agg(f ORDER BY i)
         FROM unnest(p.foto_url) WITH ORDINALITY AS u(f, i)
        WHERE nullif(btrim(f), '') IS NOT NULL),
      '{}'::text[]
    ) AS fotos,
    coalesce(
      (SELECT array_agg(btrim(n) ORDER BY i)
         FROM regexp_split_to_table(coalesce(p.nome_completo, ''), '\s*(,|;|&|\se\s)\s*')
              WITH ORDINALITY AS s(n, i)
        WHERE btrim(n) <> ''),
      '{}'::text[]
    ) AS nomes
  FROM public.palestras p
  WHERE p.palestrantes = '[]'::jsonb
),
novos AS (
  SELECT
    b.id,
    CASE
      WHEN b.nome IS NULL AND cardinality(b.fotos) = 0 AND b.cargo IS NULL AND b.sobre IS NULL
        THEN '[]'::jsonb
      WHEN cardinality(b.fotos) > 1 AND cardinality(b.nomes) = cardinality(b.fotos) THEN (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'nome', b.nomes[i],
                   'cargo', b.cargo,
                   'foto_url', b.fotos[i],
                   'sobre', CASE WHEN i = 1 THEN b.sobre END
                 ) ORDER BY i)
          FROM generate_series(1, cardinality(b.fotos)) AS i
      )
      ELSE
        jsonb_build_array(jsonb_build_object(
          'nome', coalesce(b.nome, ''),
          'cargo', b.cargo,
          'foto_url', b.fotos[1],
          'sobre', b.sobre
        ))
        || coalesce((
          SELECT jsonb_agg(
                   jsonb_build_object('nome', '', 'cargo', NULL, 'foto_url', b.fotos[i], 'sobre', NULL)
                   ORDER BY i)
            FROM generate_series(2, cardinality(b.fotos)) AS i
        ), '[]'::jsonb)
    END AS palestrantes
  FROM base b
)
UPDATE public.palestras p
   SET palestrantes = n.palestrantes
  FROM novos n
 WHERE p.id = n.id
   AND n.palestrantes <> '[]'::jsonb;

-- ---------------------------------------------------------------------
-- Trigger: mantém as colunas antigas em sincronia com "palestrantes".
-- Em um INSERT que só preencha as colunas antigas (ex.: import de backup
-- antigo), monta "palestrantes" a partir delas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.palestras_sync_palestrantes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     AND NEW.palestrantes = '[]'::jsonb
     AND nullif(btrim(coalesce(NEW.nome_completo, '')), '') IS NOT NULL THEN
    NEW.palestrantes := jsonb_build_array(jsonb_build_object(
      'nome', btrim(NEW.nome_completo),
      'cargo', nullif(btrim(coalesce(NEW.cargo, '')), ''),
      'foto_url', NEW.foto_url[1],
      'sobre', nullif(btrim(coalesce(NEW.sobre_palestrante, '')), '')
    ));
  END IF;

  NEW.nome_completo := coalesce((
    SELECT string_agg(btrim(e->>'nome'), ', ' ORDER BY i)
      FROM jsonb_array_elements(NEW.palestrantes) WITH ORDINALITY AS t(e, i)
     WHERE nullif(btrim(coalesce(e->>'nome', '')), '') IS NOT NULL
  ), '');
  NEW.cargo := nullif(btrim(coalesce(NEW.palestrantes->0->>'cargo', '')), '');
  NEW.sobre_palestrante := nullif(btrim(coalesce(NEW.palestrantes->0->>'sobre', '')), '');
  NEW.foto_url := coalesce((
    SELECT array_agg(e->>'foto_url' ORDER BY i)
      FROM jsonb_array_elements(NEW.palestrantes) WITH ORDINALITY AS t(e, i)
     WHERE nullif(btrim(coalesce(e->>'foto_url', '')), '') IS NOT NULL
  ), '{}'::text[]);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS palestras_sync_palestrantes ON public.palestras;
CREATE TRIGGER palestras_sync_palestrantes
  BEFORE INSERT OR UPDATE ON public.palestras
  FOR EACH ROW EXECUTE FUNCTION public.palestras_sync_palestrantes();

-- Faz a API do Supabase enxergar a nova coluna imediatamente.
NOTIFY pgrst, 'reload schema';
