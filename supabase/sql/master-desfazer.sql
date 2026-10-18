-- Ajustes da Área da Master (rodar depois do master-recursos.sql; pode rodar mais de uma vez)
--  1) Painel congelado: inscrições de minicurso e lista de presença continuam editáveis
--  2) Histórico: a master pode desfazer uma alteração (criou / alterou / excluiu)

-- ═════════════════════════════════════════════════════════════════════════════
-- 1) Congelamento não vale para inscrições e presença
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['minicurso_inscricoes', 'presenca_qrcodes', 'presencas', 'presenca_turmas'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_congelado', t);
    end if;
  end loop;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2) Desfazer alteração do histórico
-- ═════════════════════════════════════════════════════════════════════════════
alter table public.auditoria add column if not exists desfeito_em timestamptz;
alter table public.auditoria add column if not exists desfeito_por text;

create or replace function public.desfazer_atividade(_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.auditoria;
  v_lista text;
  v_cols text;
  v_linhas integer;
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Apenas a conta master pode desfazer alterações.';
  end if;

  select * into r from public.auditoria where id = _id for update;
  if not found then
    raise exception 'Registro não encontrado no histórico.';
  end if;
  if r.desfeito_em is not null then
    raise exception 'Essa alteração já foi desfeita.';
  end if;
  if r.tabela is null or r.registro_id is null or r.acao not in ('criou', 'alterou', 'excluiu') then
    raise exception 'Essa ação não pode ser desfeita pelo histórico.';
  end if;
  if r.tabela not in ('palestras', 'patrocinadores', 'event_config', 'comissao', 'minicursos',
                      'minicurso_inscricoes', 'presenca_qrcodes', 'presencas', 'presenca_turmas', 'profiles') then
    raise exception 'Essa área não pode ser desfeita pelo histórico.';
  end if;
  if r.tabela = 'profiles' and r.acao <> 'alterou' then
    raise exception 'Contas criadas ou excluídas não podem ser desfeitas pelo histórico.';
  end if;

  if r.acao = 'alterou' then
    -- volta só os campos que mudaram (e que ainda existem na tabela)
    select string_agg(format('%I = x.%I', c.column_name, c.column_name), ', ')
      into v_lista
      from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = r.tabela
       and c.column_name = any (r.campos) and c.is_generated = 'NEVER';
    if v_lista is null then
      raise exception 'Os campos dessa alteração não existem mais.';
    end if;
    execute format(
      'update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) x where t.id::text = $2',
      r.tabela, v_lista, r.tabela)
      using r.antes, r.registro_id;
    get diagnostics v_linhas = row_count;
    if v_linhas = 0 then
      raise exception 'Esse item não existe mais (foi excluído depois). Desfaça a exclusão primeiro.';
    end if;

  elsif r.acao = 'excluiu' then
    execute format('select count(*) from public.%I where id::text = $1', r.tabela)
      into v_linhas using r.registro_id;
    if v_linhas > 0 then
      raise exception 'Esse item já existe de novo.';
    end if;
    select string_agg(format('%I', c.column_name), ', ')
      into v_cols
      from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = r.tabela
       and r.antes ? c.column_name and c.is_generated = 'NEVER';
    execute format(
      'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)',
      r.tabela, v_cols, v_cols, r.tabela)
      using r.antes;

  else -- criou: apaga o que foi criado
    execute format('delete from public.%I where id::text = $1', r.tabela) using r.registro_id;
    get diagnostics v_linhas = row_count;
    if v_linhas = 0 then
      raise exception 'Esse item já tinha sido excluído.';
    end if;
  end if;

  update public.auditoria
     set desfeito_em = now(),
         desfeito_por = (select email from auth.users where id = auth.uid())
   where id = _id;
end;
$$;
revoke execute on function public.desfazer_atividade(bigint) from public, anon;
grant execute on function public.desfazer_atividade(bigint) to authenticated;

-- Conferência: deve listar só as tabelas do painel (sem inscrições e presença)
select event_object_table as tabela_congelavel
  from information_schema.triggers
 where trigger_schema = 'public' and trigger_name like '%\_congelado' escape '\'
 group by event_object_table
 order by 1;
