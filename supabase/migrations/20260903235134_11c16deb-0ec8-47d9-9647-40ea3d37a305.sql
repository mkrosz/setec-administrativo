CREATE TABLE public.event_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  logo_url text,
  edicao text NOT NULL DEFAULT 'XXXIII',
  ano text NOT NULL DEFAULT '2026',
  datas text NOT NULL DEFAULT '15-19 May',
  sympla_url text NOT NULL DEFAULT '',
  instagram_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_config TO authenticated;
GRANT ALL ON public.event_config TO service_role;
ALTER TABLE public.event_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_config public read" ON public.event_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "event_config admin write" ON public.event_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.palestras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foto_url text,
  nome_completo text NOT NULL,
  cargo text,
  titulo text NOT NULL,
  categoria text,
  data date,
  hora_inicio time,
  hora_fim time,
  local text,
  sobre_palestra text,
  sobre_palestrante text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.palestras TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.palestras TO authenticated;
GRANT ALL ON public.palestras TO service_role;
ALTER TABLE public.palestras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "palestras public read" ON public.palestras FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "palestras admin write" ON public.palestras FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.patrocinadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_empresa text NOT NULL,
  logo_url text,
  nivel text NOT NULL DEFAULT 'MASTER',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.patrocinadores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patrocinadores TO authenticated;
GRANT ALL ON public.patrocinadores TO service_role;
ALTER TABLE public.patrocinadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patrocinadores public read" ON public.patrocinadores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "patrocinadores admin write" ON public.patrocinadores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER event_config_updated BEFORE UPDATE ON public.event_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER palestras_updated BEFORE UPDATE ON public.palestras FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER patrocinadores_updated BEFORE UPDATE ON public.patrocinadores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.event_config (singleton, edicao, ano, datas, sympla_url, instagram_url)
VALUES (true, 'XXXIII', '2026', '15-19 May', 'https://sympla.com.br/setec', 'https://instagram.com/setec');

INSERT INTO public.palestras (nome_completo, cargo, titulo, categoria, data, hora_inicio, hora_fim, local, sobre_palestra, sobre_palestrante) VALUES
('Dr. Alan Turing', 'Pesquisador Chefe, MIT', 'O Futuro da Inteligência Artificial', 'Inteligência Artificial', '2026-05-15', '09:00', '10:30', 'Auditório A', 'Uma visão sobre os rumos da IA.', 'Pioneiro da computação.'),
('Maria Garcia', 'Tech Lead, Globo', 'Desenvolvimento Web Moderno', 'Desenvolvimento', '2026-05-16', '14:00', '16:00', 'Auditório B', 'Stacks modernas para a web.', 'Especialista em front-end.');