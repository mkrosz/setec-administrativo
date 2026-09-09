CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = 'admin' AND ativo
  )
$$;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND ativo
  )
$$;

CREATE POLICY "profiles read own" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "profiles admin read all" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));

CREATE POLICY "profiles admin update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_active_admin(auth.uid()))
  WITH CHECK (public.is_active_admin(auth.uid()));

CREATE POLICY "profiles admin delete" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_active_admin(auth.uid()));

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "palestras admin write" ON public.palestras;
CREATE POLICY "palestras admin write" ON public.palestras
  FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "patrocinadores admin write" ON public.patrocinadores;
CREATE POLICY "patrocinadores admin write" ON public.patrocinadores
  FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "event_config admin write" ON public.event_config;
CREATE POLICY "event_config admin write" ON public.event_config
  FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

INSERT INTO public.profiles (id, email, role, ativo)
SELECT u.id, coalesce(u.email, ''), 'admin', true FROM auth.users u
ON CONFLICT (id) DO NOTHING;