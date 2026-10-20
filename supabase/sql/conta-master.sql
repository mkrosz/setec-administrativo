-- Conta master do painel
-- Ninguém (nem outro administrador, nem o servidor com a chave de serviço) consegue
-- excluir, desativar, rebaixar ou alterar essa conta. Só dá para mexer nela aqui no SQL Editor,
-- desligando a proteção de propósito (veja o final do arquivo).
--
-- Na primeira vez, troque 'email-da-master@exemplo.com' (passo 2) pelo e-mail da conta
-- no SQL Editor, sem salvar o e-mail real no repositório. Se já existir uma master,
-- o passo 2 é pulado e o arquivo só atualiza as travas.

-- 1) Marca de conta master (só pode existir uma)
alter table public.profiles add column if not exists master boolean not null default false;
create unique index if not exists profiles_um_master on public.profiles (master) where master;

-- 2) Promove a conta (precisa já ter sido criada no painel)
do $$
declare
  v_email text := lower('email-da-master@exemplo.com');
begin
  if exists (select 1 from public.profiles where master) then
    raise notice 'Já existe uma conta master; promoção ignorada.';
    return;
  end if;
  if v_email = 'email-da-master@exemplo.com' then
    raise exception 'Troque email-da-master@exemplo.com pelo e-mail da conta master antes de rodar este SQL.';
  end if;
  if not exists (select 1 from public.profiles where lower(email) = v_email) then
    raise exception 'A conta % ainda não existe em profiles. Crie a conta no painel antes de rodar este SQL.', v_email;
  end if;
  -- desliga a trava só durante a promoção, caso o SQL esteja sendo rodado de novo
  perform set_config('setec.liberar_master', 'on', true);
  update public.profiles
     set master = true, role = 'admin', ativo = true
   where lower(email) = v_email;
end $$;

-- 3) Trava na tabela profiles
create or replace function public.proteger_conta_master()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- liberação manual e intencional (somente pelo SQL Editor, dentro da mesma transação)
  if current_setting('setec.liberar_master', true) = 'on' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.master then
      raise exception 'Não é permitido criar outra conta master.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.master then
      raise exception 'A conta master não pode ser excluída.';
    end if;
    return old;
  end if;

  -- UPDATE
  if old.master then
    if new.role is distinct from old.role
       or new.ativo is distinct from old.ativo
       or new.email is distinct from old.email
       or new.id is distinct from old.id
       or new.master is distinct from old.master then
      raise exception 'A conta master não pode ser alterada.';
    end if;
  elsif new.master then
    raise exception 'Não é permitido transformar outra conta em master.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_proteger_master on public.profiles;
create trigger profiles_proteger_master
  before insert or update or delete on public.profiles
  for each row execute function public.proteger_conta_master();

-- 4) Trava na conta de login (auth.users): impede excluir, banir ou trocar o e-mail
create or replace function public.proteger_usuario_master()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('setec.liberar_master', true) = 'on' then
    return coalesce(new, old);
  end if;
  if not exists (select 1 from public.profiles where id = old.id and master) then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'A conta master não pode ser excluída.';
  end if;

  -- login, troca de senha pelo "esqueci minha senha" etc. continuam funcionando;
  -- o que não pode é trocar o e-mail, banir ou desativar a conta
  if new.email is distinct from old.email
     or new.banned_until is distinct from old.banned_until
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'A conta master não pode ser alterada.';
  end if;
  return new;
end;
$$;

drop trigger if exists usuarios_proteger_master on auth.users;
create trigger usuarios_proteger_master
  before update or delete on auth.users
  for each row execute function public.proteger_usuario_master();

-- Conferência: deve mostrar a conta com master = true, role = admin e ativo = true
select email, role, ativo, master from public.profiles where master;

-- ─────────────────────────────────────────────────────────────────────────────
-- Se um dia precisar mexer na conta master (ex.: trocar qual é a master),
-- rode tudo junto, dentro de uma transação:
--
-- begin;
--   select set_config('setec.liberar_master', 'on', true);
--   update public.profiles set master = false where master;
--   update public.profiles set master = true, role = 'admin', ativo = true where lower(email) = 'novo@email.com';
-- commit;
