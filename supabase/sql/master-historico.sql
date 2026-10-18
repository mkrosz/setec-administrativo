-- Histórico da master: apagar o histórico e nome dos apoiadores nos registros
-- (rodar depois do master-recursos.sql e do master-desfazer.sql; pode rodar mais de uma vez)

-- 1) O nome do item agora também considera "nome_empresa" (apoiadores) e "nome_completo"
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

-- registros antigos de apoiadores que ficaram sem nome
update public.auditoria
   set descricao = coalesce(antes ->> 'nome_empresa', depois ->> 'nome_empresa')
 where descricao is null
   and tabela = 'patrocinadores'
   and coalesce(antes ->> 'nome_empresa', depois ->> 'nome_empresa') is not null;

-- 2) Apagar o histórico (só a master). Fica um registro dizendo quem apagou e quantos eram.
create or replace function public.apagar_historico()
returns integer language plpgsql security definer set search_path = public as $$
declare v_total integer;
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Apenas a conta master pode apagar o histórico.';
  end if;
  delete from public.auditoria;
  get diagnostics v_total = row_count;
  insert into public.auditoria (usuario_id, usuario_email, acao, descricao)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), 'apagou o histórico',
          v_total || ' registro' || case when v_total = 1 then '' else 's' end);
  return v_total;
end;
$$;
revoke execute on function public.apagar_historico() from public, anon;
grant execute on function public.apagar_historico() to authenticated;

-- Conferência
select count(*) as registros_no_historico from public.auditoria;
