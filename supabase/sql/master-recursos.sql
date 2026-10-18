-- Recursos da conta master e níveis de acesso (versão final)
-- Precisa ter rodado antes: conta-master.sql e corrigir-rls-perfis.sql
-- (pode rodar mais de uma vez; substitui o niveis-acesso.sql, que não precisa mais ser rodado)
--
--   Master                 : tudo.
--   Acesso total temporário: concedido pela master por um prazo. Muda o nível das contas,
--                            libera/desativa/exclui contas, envia redefinição de senha e edita
--                            o painel mesmo congelado. Não vê histórico, restauração, congelamento,
--                            transferência de master nem concede acesso total.
--   Administrador          : tudo, menos o Controle de Acessos além de "Liberar" contas novas
--                            (que entram como usuário comum).
--   Usuário comum          : sem Controle de Acessos, presença, reset, importação e ativar/desativar evento.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1) Acesso total temporário
-- ═════════════════════════════════════════════════════════════════════════════
alter table public.profiles add column if not exists acesso_total_ate timestamptz;

create or replace function public.is_master(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = _user_id and master and ativo)
$$;

-- master, ou conta com acesso total dentro do prazo
create or replace function public.tem_acesso_total(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id and ativo and (master or acesso_total_ate > now())
  )
$$;

revoke execute on function public.is_master(uuid) from public, anon;
revoke execute on function public.tem_acesso_total(uuid) from public, anon;
grant execute on function public.is_master(uuid) to authenticated, service_role;
grant execute on function public.tem_acesso_total(uuid) to authenticated, service_role;

-- só a master concede ou retira o acesso total
create or replace function public.proteger_acesso_total()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('setec.liberar_master', true) = 'on' then
    return new;  -- transferência de master em andamento
  end if;
  if new.acesso_total_ate is distinct from old.acesso_total_ate
     and auth.uid() is not null
     and not public.is_master(auth.uid()) then
    raise exception 'Apenas a conta master pode conceder ou retirar o acesso total.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_proteger_acesso_total on public.profiles;
create trigger profiles_proteger_acesso_total
  before update on public.profiles
  for each row execute function public.proteger_acesso_total();

create or replace function public.conceder_acesso_total(_user_id uuid, _horas integer)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_ate timestamptz;
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Apenas a conta master pode conceder acesso total.';
  end if;
  if _horas is null or _horas < 1 or _horas > 24 * 30 then
    raise exception 'Escolha um prazo entre 1 hora e 30 dias.';
  end if;
  v_ate := now() + make_interval(hours => _horas);
  update public.profiles set acesso_total_ate = v_ate
   where id = _user_id and ativo and not master;
  if not found then
    raise exception 'A conta precisa estar liberada (e não pode ser a master).';
  end if;
  return v_ate;
end;
$$;

create or replace function public.revogar_acesso_total(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Apenas a conta master pode retirar o acesso total.';
  end if;
  update public.profiles set acesso_total_ate = null where id = _user_id;
end;
$$;

revoke execute on function public.conceder_acesso_total(uuid, integer) from public, anon;
revoke execute on function public.revogar_acesso_total(uuid) from public, anon;
grant execute on function public.conceder_acesso_total(uuid, integer) to authenticated;
grant execute on function public.revogar_acesso_total(uuid) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2) Controle de Acessos (regras da tabela profiles)
-- ═════════════════════════════════════════════════════════════════════════════
drop policy if exists "profiles admin read all" on public.profiles;
create policy "profiles admin read all" on public.profiles
  for select to authenticated
  using (public.is_active_admin(auth.uid()) or public.tem_acesso_total(auth.uid()));

-- master / acesso total: qualquer conta (a trava da master continua valendo)
-- administrador: só "Liberar" contas novas, que continuam como usuário comum
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles
  for update to authenticated
  using (
    public.tem_acesso_total(auth.uid())
    or (public.is_active_admin(auth.uid()) and role = 'user' and not ativo and not master)
  )
  with check (
    public.tem_acesso_total(auth.uid())
    or (public.is_active_admin(auth.uid()) and role = 'user' and ativo and not master)
  );

drop policy if exists "profiles admin delete" on public.profiles;
create policy "profiles admin delete" on public.profiles
  for delete to authenticated
  using (public.tem_acesso_total(auth.uid()));

-- Último acesso de cada conta (só a master vê)
create or replace function public.ultimos_acessos()
returns table (id uuid, ultimo_acesso timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Apenas a conta master pode ver os últimos acessos.';
  end if;
  return query select u.id, u.last_sign_in_at from auth.users u;
end;
$$;
revoke execute on function public.ultimos_acessos() from public, anon;
grant execute on function public.ultimos_acessos() to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3) Lista de presença e evento ativo: só administradores (inclui a master)
-- ═════════════════════════════════════════════════════════════════════════════
drop policy if exists "presenca_qrcodes painel" on public.presenca_qrcodes;
create policy "presenca_qrcodes painel" on public.presenca_qrcodes
  for all to authenticated
  using (public.is_active_admin(auth.uid()))
  with check (public.is_active_admin(auth.uid()));

drop policy if exists "presencas painel" on public.presencas;
create policy "presencas painel" on public.presencas
  for all to authenticated
  using (public.is_active_admin(auth.uid()))
  with check (public.is_active_admin(auth.uid()));

drop policy if exists "presenca_turmas painel" on public.presenca_turmas;
create policy "presenca_turmas painel" on public.presenca_turmas
  for all to authenticated
  using (public.is_active_admin(auth.uid()))
  with check (public.is_active_admin(auth.uid()));

create or replace function public.proteger_evento_ativo()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.evento_ativo is distinct from old.evento_ativo
     and auth.uid() is not null
     and not public.is_active_admin(auth.uid()) then
    raise exception 'Apenas administradores podem ativar ou desativar o evento.';
  end if;
  return new;
end;
$$;
drop trigger if exists event_config_proteger_evento_ativo on public.event_config;
create trigger event_config_proteger_evento_ativo
  before update on public.event_config
  for each row execute function public.proteger_evento_ativo();

-- ═════════════════════════════════════════════════════════════════════════════
-- 4) Histórico de atividades (auditoria) — só a master lê; ninguém edita ou apaga
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.auditoria (
  id bigserial primary key,
  criado_em timestamptz not null default now(),
  usuario_id uuid,
  usuario_email text,
  acao text not null,          -- criou | alterou | excluiu | ou uma ação do painel (resetou, importou...)
  tabela text,
  registro_id text,
  descricao text,
  campos text[],               -- campos alterados (em "alterou")
  antes jsonb,
  depois jsonb
);
create index if not exists auditoria_criado_em on public.auditoria (criado_em desc);
create index if not exists auditoria_usuario on public.auditoria (usuario_email);

alter table public.auditoria enable row level security;
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;
grant all on public.auditoria to service_role;
grant usage, select on sequence public.auditoria_id_seq to service_role;

drop policy if exists "auditoria master le" on public.auditoria;
create policy "auditoria master le" on public.auditoria
  for select to authenticated using (public.is_master(auth.uid()));

-- Registra alterações feitas por quem está logado no painel
-- (inscrições pelo site público e processos automáticos não entram)
create or replace function public.auditar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_antes jsonb;
  v_depois jsonb;
  v_campos text[];
  v_linha jsonb;
begin
  if v_uid is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    v_depois := to_jsonb(new);
    v_linha := v_depois;
  elsif tg_op = 'DELETE' then
    v_antes := to_jsonb(old);
    v_linha := v_antes;
  else
    -- só os campos que mudaram (ignora updated_at)
    select array_agg(n.key order by n.key),
           jsonb_object_agg(n.key, o.value),
           jsonb_object_agg(n.key, n.value)
      into v_campos, v_antes, v_depois
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value
       and n.key not in ('updated_at');
    if v_campos is null then
      return new;  -- nada mudou de fato
    end if;
    v_linha := to_jsonb(new);
  end if;

  insert into public.auditoria (usuario_id, usuario_email, acao, tabela, registro_id, descricao, campos, antes, depois)
  values (
    v_uid,
    (select email from auth.users where id = v_uid),
    case tg_op when 'INSERT' then 'criou' when 'DELETE' then 'excluiu' else 'alterou' end,
    tg_table_name,
    v_linha ->> 'id',
    coalesce(v_linha ->> 'titulo', v_linha ->> 'nome_empresa', v_linha ->> 'nome', v_linha ->> 'nome_completo',
             v_linha ->> 'email', v_linha ->> 'edicao'),
    v_campos,
    v_antes,
    v_depois
  );
  return coalesce(new, old);
end;
$$;

-- Ações do painel que não são uma linha só (reset, importação, exportação, restauração)
create or replace function public.registrar_atividade(_acao text, _descricao text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user(auth.uid()) then
    raise exception 'Sem permissão.';
  end if;
  insert into public.auditoria (usuario_id, usuario_email, acao, descricao)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), left(_acao, 40), left(_descricao, 500));
end;
$$;
revoke execute on function public.registrar_atividade(text, text) from public, anon;
grant execute on function public.registrar_atividade(text, text) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5) Congelar painel — com ele ligado, só a master e quem tem acesso total editam
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.painel_controle (
  id smallint primary key default 1 check (id = 1),
  congelado boolean not null default false,
  alterado_em timestamptz,
  alterado_por text
);
insert into public.painel_controle (id) values (1) on conflict (id) do nothing;

alter table public.painel_controle enable row level security;
revoke all on public.painel_controle from anon, authenticated;
grant select on public.painel_controle to authenticated;
grant all on public.painel_controle to service_role;
drop policy if exists "painel_controle leitura" on public.painel_controle;
create policy "painel_controle leitura" on public.painel_controle
  for select to authenticated using (public.is_active_user(auth.uid()));

create or replace function public.definir_congelamento(_congelar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text := (select email from auth.users where id = auth.uid());
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Apenas a conta master pode congelar o painel.';
  end if;
  update public.painel_controle
     set congelado = _congelar, alterado_em = now(), alterado_por = v_email
   where id = 1;
  insert into public.auditoria (usuario_id, usuario_email, acao, descricao)
  values (auth.uid(), v_email, case when _congelar then 'congelou' else 'descongelou' end, 'Painel');
end;
$$;
revoke execute on function public.definir_congelamento(boolean) from public, anon;
grant execute on function public.definir_congelamento(boolean) to authenticated;

create or replace function public.bloquear_se_congelado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('setec.liberar_master', true) = 'on' then
    return coalesce(new, old);  -- transferência de master em andamento
  end if;
  if auth.uid() is not null
     and (select congelado from public.painel_controle where id = 1)
     and not public.tem_acesso_total(auth.uid()) then
    raise exception 'O painel está congelado pela conta master: no momento só é possível visualizar.';
  end if;
  return coalesce(new, old);
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6) Liga histórico e congelamento nas tabelas do painel
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array[
    'palestras', 'patrocinadores', 'event_config', 'comissao', 'minicursos',
    'minicurso_inscricoes', 'presenca_qrcodes', 'presencas', 'presenca_turmas', 'profiles'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute function public.auditar()',
        t || '_auditar', t);
      execute format('drop trigger if exists %I on public.%I', t || '_congelado', t);
      -- inscrições de minicurso e lista de presença continuam editáveis com o painel congelado
      if t not in ('minicurso_inscricoes', 'presenca_qrcodes', 'presencas', 'presenca_turmas') then
        execute format(
          'create trigger %I before insert or update or delete on public.%I for each row execute function public.bloquear_se_congelado()',
          t || '_congelado', t);
      end if;
    end if;
  end loop;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 7) Pontos de restauração (cópia automática antes de reset/importação; guarda os 10 últimos)
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.pontos_restauracao (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  criado_por_email text,
  motivo text not null,
  resumo jsonb,
  dados jsonb not null
);
create index if not exists pontos_restauracao_criado_em on public.pontos_restauracao (criado_em desc);

alter table public.pontos_restauracao enable row level security;
revoke all on public.pontos_restauracao from anon, authenticated;
grant select, insert, delete on public.pontos_restauracao to authenticated;
grant all on public.pontos_restauracao to service_role;

drop policy if exists "pontos criar" on public.pontos_restauracao;
create policy "pontos criar" on public.pontos_restauracao
  for insert to authenticated
  with check (public.is_active_admin(auth.uid()) and criado_por = auth.uid());

drop policy if exists "pontos master le" on public.pontos_restauracao;
create policy "pontos master le" on public.pontos_restauracao
  for select to authenticated using (public.is_master(auth.uid()));

drop policy if exists "pontos master apaga" on public.pontos_restauracao;
create policy "pontos master apaga" on public.pontos_restauracao
  for delete to authenticated using (public.is_master(auth.uid()));

create or replace function public.pontos_preencher_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.criado_por_email := (select email from auth.users where id = new.criado_por);
  return new;
end;
$$;
drop trigger if exists pontos_email on public.pontos_restauracao;
create trigger pontos_email
  before insert on public.pontos_restauracao
  for each row execute function public.pontos_preencher_email();

create or replace function public.apagar_pontos_antigos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.pontos_restauracao
   where id in (select id from public.pontos_restauracao order by criado_em desc offset 10);
  return null;
end;
$$;
drop trigger if exists pontos_limite on public.pontos_restauracao;
create trigger pontos_limite
  after insert on public.pontos_restauracao
  for each statement execute function public.apagar_pontos_antigos();

-- ═════════════════════════════════════════════════════════════════════════════
-- 8) Transferir a conta master
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.transferir_master(_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := auth.uid();
  v_novo uuid;
begin
  if not public.is_master(v_eu) then
    raise exception 'Apenas a conta master pode transferir a conta master.';
  end if;
  select id into v_novo from public.profiles
   where lower(email) = lower(trim(_email)) and ativo and not master;
  if v_novo is null then
    raise exception 'Não há conta liberada com esse e-mail.';
  end if;

  perform set_config('setec.liberar_master', 'on', true);
  update public.profiles set master = false where id = v_eu;
  update public.profiles
     set master = true, role = 'admin', ativo = true, acesso_total_ate = null
   where id = v_novo;
  perform set_config('setec.liberar_master', 'off', true);

  insert into public.auditoria (usuario_id, usuario_email, acao, descricao)
  values (v_eu, (select email from auth.users where id = v_eu), 'transferiu master', 'Para ' || lower(trim(_email)));
end;
$$;
revoke execute on function public.transferir_master(text) from public, anon;
grant execute on function public.transferir_master(text) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 9) Histórico: apaga registros com mais de 12 meses (todo dia às 6h15 UTC)
-- ═════════════════════════════════════════════════════════════════════════════
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'setec-limpar-auditoria';
select cron.schedule(
  'setec-limpar-auditoria',
  '15 6 * * *',
  $$delete from public.auditoria where criado_em < now() - interval '12 months'$$
);

-- Conferência
select 'auditoria' as tabela, count(*) from public.auditoria
union all select 'pontos_restauracao', count(*) from public.pontos_restauracao
union all select 'painel congelado? ' || congelado::text, 1 from public.painel_controle;
