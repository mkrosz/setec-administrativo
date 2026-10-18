-- Corrige o erro "stack depth limit exceeded" no login.
-- Causa: alguma regra (policy) da tabela profiles consulta a própria profiles,
-- que dispara a regra de novo, sem fim. Este SQL deixa só as regras corretas,
-- que usam funções SECURITY DEFINER (elas leem profiles sem passar pelas regras).

-- 1) Funções de checagem (lêem profiles sem acionar o RLS)
create or replace function public.is_active_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id and role = 'admin' and ativo
  )
$$;

create or replace function public.is_active_user(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id and ativo
  )
$$;

revoke execute on function public.is_active_admin(uuid) from public, anon;
revoke execute on function public.is_active_user(uuid) from public, anon;
grant execute on function public.is_active_admin(uuid) to authenticated, service_role;
grant execute on function public.is_active_user(uuid) to authenticated, service_role;

-- 2) Remove TODAS as regras atuais de profiles (inclusive a que causa a recursão)
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy %I on public.profiles', r.policyname);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.profiles no force row level security;

-- 3) Recria só as regras certas
create policy "profiles read own" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "profiles admin read all" on public.profiles
  for select to authenticated using (public.is_active_admin(auth.uid()));

create policy "profiles admin update" on public.profiles
  for update to authenticated
  using (public.is_active_admin(auth.uid()))
  with check (public.is_active_admin(auth.uid()));

create policy "profiles admin delete" on public.profiles
  for delete to authenticated using (public.is_active_admin(auth.uid()));

-- Conferência: deve listar exatamente as 4 regras acima
select policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename = 'profiles';
