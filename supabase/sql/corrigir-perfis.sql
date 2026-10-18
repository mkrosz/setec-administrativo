-- Corrige perfis cujo id não bate com a conta de login (auth.users).
-- Sintoma: o painel mostra a conta como "Acesso liberado", mas no login aparece
-- "Seu acesso ainda não foi liberado" — o login procura o perfil pelo id da conta,
-- e o perfil foi criado com outro id (ex.: conta criada ou recriada direto no Supabase).

-- 1) Diagnóstico: perfis sem conta com o mesmo id, e contas sem perfil
select 'perfil com id errado' as problema, p.email, p.id as id_no_perfil, u.id as id_da_conta
  from public.profiles p
  join auth.users u on lower(u.email) = lower(p.email)
 where u.id <> p.id
union all
select 'conta sem perfil', u.email, null, u.id
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id or lower(p.email) = lower(u.email));

-- 2) Correção: aponta cada perfil para o id certo da conta de mesmo e-mail
begin;
  select set_config('setec.liberar_master', 'on', true);  -- a trava da conta master também bloqueia troca de id
  update public.profiles p
     set id = u.id
    from auth.users u
   where lower(u.email) = lower(p.email)
     and u.id <> p.id
     and not exists (select 1 from public.profiles outro where outro.id = u.id);
commit;

-- 3) Conferência: deve voltar vazio
select p.email, p.id, u.id
  from public.profiles p
  join auth.users u on lower(u.email) = lower(p.email)
 where u.id <> p.id;
