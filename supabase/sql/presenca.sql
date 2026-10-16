-- =====================================================================
-- SETEC • Lista de Presença por palestra (QR Code de 10 minutos)
-- Pode ser executado mais de uma vez com segurança (idempotente),
-- inclusive em bancos que já rodaram a versão anterior deste arquivo.
-- =====================================================================

-- QR Codes gerados para cada palestra. Cada um vale 10 minutos.
CREATE TABLE IF NOT EXISTS public.presenca_qrcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  palestra_id uuid NOT NULL REFERENCES public.palestras(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  encerrado boolean NOT NULL DEFAULT false,
  criado_por uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS presenca_qrcodes_palestra_idx ON public.presenca_qrcodes (palestra_id);

-- Turmas que aparecem para o aluno escolher (além de "N/A", que é fixo).
CREATE TABLE IF NOT EXISTS public.presenca_turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE CHECK (char_length(btrim(nome)) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.presenca_turmas (nome) VALUES ('4º ano'), ('5º ano')
ON CONFLICT (nome) DO NOTHING;

-- Presenças registradas (pelo QR Code ou manualmente no painel).
-- "ano_turma" guarda o nome da turma (ex.: "4º ano", "Logística", "N/A").
CREATE TABLE IF NOT EXISTS public.presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  palestra_id uuid NOT NULL REFERENCES public.palestras(id) ON DELETE CASCADE,
  qrcode_id uuid REFERENCES public.presenca_qrcodes(id) ON DELETE SET NULL,
  nome_completo text NOT NULL CHECK (char_length(btrim(nome_completo)) BETWEEN 3 AND 160),
  ra text NOT NULL CHECK (ra ~ '^[0-9]{5,20}$'),
  ano_turma text NOT NULL,
  origem text NOT NULL DEFAULT 'qrcode' CHECK (origem IN ('qrcode', 'manual')),
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  precisao_m double precision,
  localizacao text,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presencas_palestra_ra_unique UNIQUE (palestra_id, ra)
);
CREATE INDEX IF NOT EXISTS presencas_palestra_idx ON public.presencas (palestra_id);

-- Migração da versão anterior: turma deixa de ser só '4ano'/'5ano'.
ALTER TABLE public.presencas DROP CONSTRAINT IF EXISTS presencas_ano_turma_check;
UPDATE public.presencas SET ano_turma = '4º ano' WHERE ano_turma = '4ano';
UPDATE public.presencas SET ano_turma = '5º ano' WHERE ano_turma = '5ano';
ALTER TABLE public.presencas
  ADD CONSTRAINT presencas_ano_turma_check CHECK (char_length(btrim(ano_turma)) BETWEEN 1 AND 60);

-- Acesso: apenas usuários ativos do painel leem/escrevem direto nas tabelas.
-- Os alunos (anon) só leem as turmas e usam as funções abaixo.
REVOKE ALL ON public.presenca_qrcodes FROM anon;
REVOKE ALL ON public.presencas FROM anon;
REVOKE ALL ON public.presenca_turmas FROM anon;
GRANT SELECT ON public.presenca_turmas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presenca_qrcodes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presencas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presenca_turmas TO authenticated;
GRANT ALL ON public.presenca_qrcodes TO service_role;
GRANT ALL ON public.presencas TO service_role;
GRANT ALL ON public.presenca_turmas TO service_role;

ALTER TABLE public.presenca_qrcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presenca_turmas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presenca_qrcodes painel" ON public.presenca_qrcodes;
CREATE POLICY "presenca_qrcodes painel" ON public.presenca_qrcodes
  FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "presencas painel" ON public.presencas;
CREATE POLICY "presencas painel" ON public.presencas
  FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "presenca_turmas leitura" ON public.presenca_turmas;
CREATE POLICY "presenca_turmas leitura" ON public.presenca_turmas
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "presenca_turmas painel" ON public.presenca_turmas;
CREATE POLICY "presenca_turmas painel" ON public.presenca_turmas
  FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

-- Dados públicos da palestra a partir do token do QR Code (tela do aluno).
CREATE OR REPLACE FUNCTION public.presenca_qrcode_info(_token uuid)
RETURNS TABLE (
  titulo text,
  palestrante text,
  data date,
  hora_inicio time,
  hora_fim time,
  local text,
  expira_em timestamptz,
  ativo boolean,
  agora timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.titulo, p.nome_completo, p.data, p.hora_inicio, p.hora_fim, p.local,
         q.expira_em, (NOT q.encerrado AND q.expira_em > now()), now()
  FROM public.presenca_qrcodes q
  JOIN public.palestras p ON p.id = q.palestra_id
  WHERE q.token = _token
$$;

-- Registro de presença pelo aluno. O horário vem do servidor (now()).
-- _ano recebe o nome da turma (uma das cadastradas ou 'N/A').
CREATE OR REPLACE FUNCTION public.registrar_presenca(
  _token uuid,
  _nome text,
  _ra text,
  _ano text,
  _latitude double precision,
  _longitude double precision,
  _precisao double precision DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.presenca_qrcodes%ROWTYPE;
  v_nome text := btrim(regexp_replace(coalesce(_nome, ''), '\s+', ' ', 'g'));
  v_ra text := regexp_replace(coalesce(_ra, ''), '\D', '', 'g');
  v_turma text := btrim(coalesce(_ano, ''));
  v_em timestamptz;
BEGIN
  SELECT * INTO v_qr FROM public.presenca_qrcodes WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR Code inválido.';
  END IF;
  IF v_qr.encerrado OR v_qr.expira_em <= now() THEN
    RAISE EXCEPTION 'Este QR Code expirou. Peça um novo ao organizador.';
  END IF;
  IF char_length(v_nome) < 3 OR position(' ' IN v_nome) = 0 THEN
    RAISE EXCEPTION 'Informe seu nome completo.';
  END IF;
  IF v_ra !~ '^[0-9]{5,20}$' THEN
    RAISE EXCEPTION 'RA inválido. Use apenas números.';
  END IF;
  IF v_turma <> 'N/A' AND NOT EXISTS (SELECT 1 FROM public.presenca_turmas WHERE nome = v_turma) THEN
    RAISE EXCEPTION 'Selecione a sua turma.';
  END IF;
  IF _latitude IS NULL OR _longitude IS NULL THEN
    RAISE EXCEPTION 'Não foi possível obter sua localização.';
  END IF;

  INSERT INTO public.presencas
    (palestra_id, qrcode_id, nome_completo, ra, ano_turma, origem, latitude, longitude, precisao_m)
  VALUES
    (v_qr.palestra_id, v_qr.id, left(v_nome, 160), v_ra, v_turma, 'qrcode', _latitude, _longitude, _precisao)
  ON CONFLICT (palestra_id, ra) DO NOTHING
  RETURNING registrado_em INTO v_em;

  IF v_em IS NULL THEN
    RAISE EXCEPTION 'Este RA já registrou presença nesta palestra.';
  END IF;
  RETURN v_em;
END;
$$;

REVOKE ALL ON FUNCTION public.presenca_qrcode_info(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_presenca(uuid, text, text, text, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.presenca_qrcode_info(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_presenca(uuid, text, text, text, double precision, double precision, double precision) TO anon, authenticated, service_role;

-- Faz a API do Supabase enxergar as novas tabelas/funções imediatamente.
NOTIFY pgrst, 'reload schema';
