-- Reconstrói o histórico de antes de 05/10/2026 (apoiadores, palestras e comissão),
-- usando os dados que estão no banco. Autor: autor@exemplo.com.
-- Rodar depois do master-recursos.sql, master-desfazer.sql e master-historico.sql.
-- Pode rodar de novo: apaga os registros reconstruídos e cria de novo.
--
-- Casos especiais (como foi contado):
--  • Última palestra de terça (06/10): criada como rascunho, sem imagem e sem título; depois completada.
--  • Primeira palestra de sexta (09/10): criada pronta na quinta (08/10), 2º horário (14h30);
--    mais tarde foi para sexta, quando entrou a palestra que hoje está na quinta às 14h30.
--  • Palestra do Bruno Aguilar: criada como rascunho, sem imagem, título, rede social e tag; depois completada.
--  • ITIX: entrou como MASTER e depois foi rebaixada para GOLD.
--  • Todo o resto: criado direto, já pronto.
-- Horários: usa a data de criação real do banco quando ela é anterior a 05/10;
-- se não for (ex.: dado importado depois), distribui a partir de 21/09.
-- Os registros entram como qualquer outro do histórico: podem ser desfeitos e são apagados
-- junto com o resto pelo botão "Apagar histórico". (A coluna "reconstruido" só serve para
-- este SQL saber quais apagar e recriar se for rodado de novo.)

alter table public.auditoria add column if not exists reconstruido boolean not null default false;

do $$
declare
  v_email  text := 'autor@exemplo.com';
  v_uid    uuid;
  v_limite timestamptz := '2026-10-05 00:00:00-03';
  v_inicio timestamptz := '2026-09-21 19:00:00-03';
  n        integer := 0;
  r        record;
  v_linha  jsonb;
  v_criado jsonb;
  v_quando timestamptz;
  v_alt    timestamptz;
  v_terca  uuid;
  v_sexta  uuid;
  v_quinta uuid;
  v_bruno  uuid;
  v_itix   uuid;
  v_quinta_quando timestamptz;
  v_campos text[];
  v_antes  jsonb;
  v_depois jsonb;
begin
  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is null then
    raise exception 'A conta % não foi encontrada.', v_email;
  end if;

  delete from public.auditoria where reconstruido;

  -- Casos especiais
  select id into v_terca from public.palestras
   where data = '2026-10-06' and not rascunho order by hora_inicio desc limit 1;
  select id into v_sexta from public.palestras
   where data = '2026-10-09' and not rascunho order by hora_inicio asc limit 1;
  select id into v_quinta from public.palestras
   where data = '2026-10-08' and hora_inicio = '14:30' and not rascunho limit 1;
  select p.id into v_bruno from public.palestras p
   where p.nome_completo ilike '%bruno%aguilar%'
      or exists (select 1 from jsonb_array_elements(coalesce(p.palestrantes, '[]'::jsonb)) e
                  where e ->> 'nome' ilike '%bruno%aguilar%')
   limit 1;
  select id into v_itix from public.patrocinadores where nome_empresa ilike '%itix%' limit 1;

  raise notice 'Terça (última): %', (select titulo from public.palestras where id = v_terca);
  raise notice 'Sexta (primeira): %', (select titulo from public.palestras where id = v_sexta);
  raise notice 'Quinta 14h30: %', (select titulo from public.palestras where id = v_quinta);
  raise notice 'Bruno Aguilar: %', (select titulo from public.palestras where id = v_bruno);
  raise notice 'ITIX: %', (select nome_empresa || ' (' || nivel || ')' from public.patrocinadores where id = v_itix);

  -- ── Apoiadores ──────────────────────────────────────────────────────────────
  for r in select * from public.patrocinadores order by created_at loop
    n := n + 1;
    v_quando := case when r.created_at < v_limite then r.created_at else v_inicio + n * interval '2 hours 17 minutes' end;
    v_linha := to_jsonb(r);

    if r.id = v_itix then
      v_criado := v_linha || jsonb_build_object('nivel', 'MASTER');
      insert into public.auditoria (criado_em, usuario_id, usuario_email, acao, tabela, registro_id, descricao, antes, depois, reconstruido)
      values (v_quando, v_uid, v_email, 'criou', 'patrocinadores', r.id::text, r.nome_empresa, null, v_criado, true);
      v_alt := least(v_quando + interval '1 day', v_limite - interval '6 hours');
      if v_alt <= v_quando then v_alt := v_quando + interval '30 minutes'; end if;
      insert into public.auditoria (criado_em, usuario_id, usuario_email, acao, tabela, registro_id, descricao, campos, antes, depois, reconstruido)
      values (v_alt, v_uid, v_email, 'alterou', 'patrocinadores', r.id::text, r.nome_empresa,
              array['nivel'], jsonb_build_object('nivel', 'MASTER'), jsonb_build_object('nivel', r.nivel), true);
    else
      insert into public.auditoria (criado_em, usuario_id, usuario_email, acao, tabela, registro_id, descricao, antes, depois, reconstruido)
      values (v_quando, v_uid, v_email, 'criou', 'patrocinadores', r.id::text, r.nome_empresa, null, v_linha, true);
    end if;
  end loop;

  -- ── Comissão ────────────────────────────────────────────────────────────────
  if to_regclass('public.comissao') is not null then
    for r in execute 'select * from public.comissao order by created_at' loop
      n := n + 1;
      v_quando := case when r.created_at < v_limite then r.created_at else v_inicio + n * interval '2 hours 17 minutes' end;
      insert into public.auditoria (criado_em, usuario_id, usuario_email, acao, tabela, registro_id, descricao, antes, depois, reconstruido)
      values (v_quando, v_uid, v_email, 'criou', 'comissao', r.id::text, r.nome, null, to_jsonb(r), true);
    end loop;
  end if;

  -- ── Palestras ───────────────────────────────────────────────────────────────
  -- a de quinta 14h30 entra antes, para a mudança da de sexta acontecer depois dela
  select case when created_at < v_limite then created_at else v_inicio + 500 * interval '1 minute' end
    into v_quinta_quando from public.palestras where id = v_quinta;

  for r in select * from public.palestras where not rascunho order by created_at loop
    n := n + 1;
    v_quando := case when r.created_at < v_limite then r.created_at else v_inicio + n * interval '2 hours 17 minutes' end;
    if r.id = v_quinta and v_quinta_quando is not null then
      v_quando := v_quinta_quando;
    end if;
    v_linha := to_jsonb(r);
    -- quando foi completada / alterada: o updated_at real, se fizer sentido; senão 1 dia depois
    v_alt := case when r.updated_at > v_quando and r.updated_at < v_limite then r.updated_at
                  else least(v_quando + interval '1 day', v_limite - interval '6 hours') end;
    if v_alt <= v_quando then v_alt := v_quando + interval '45 minutes'; end if;

    if r.id = v_terca or r.id = v_bruno then
      -- criada como rascunho: sem título e sem imagem (Bruno: também sem rede social e sem tag)
      v_criado := v_linha || jsonb_build_object(
        'titulo', '',
        'rascunho', true,
        'foto_url', null,
        'palestrantes', coalesce(
          (select jsonb_agg(e || jsonb_build_object('foto_url', null))
             from jsonb_array_elements(coalesce(r.palestrantes, '[]'::jsonb)) e), '[]'::jsonb));
      v_campos := array['foto_url', 'palestrantes', 'rascunho', 'titulo'];
      if r.id = v_bruno then
        v_criado := v_criado || jsonb_build_object('links', '[]'::jsonb, 'categoria', null);
        v_campos := array['categoria', 'foto_url', 'links', 'palestrantes', 'rascunho', 'titulo'];
      end if;
      select jsonb_object_agg(k, v_criado -> k), jsonb_object_agg(k, v_linha -> k)
        into v_antes, v_depois from unnest(v_campos) k;

      insert into public.auditoria (criado_em, usuario_id, usuario_email, acao, tabela, registro_id, descricao, antes, depois, reconstruido)
      values (v_quando, v_uid, v_email, 'criou', 'palestras', r.id::text,
              'Palestra de ' || coalesce(nullif(r.nome_completo, ''), 'palestrante'), null, v_criado, true);
      insert into public.auditoria (criado_em, usuario_id, usuario_email, acao, tabela, registro_id, descricao, campos, antes, depois, reconstruido)
      values (v_alt, v_uid, v_email, 'alterou', 'palestras', r.id::text, r.titulo, v_campos, v_antes, v_depois, true);

    elsif r.id = v_sexta then
      -- criada pronta na quinta, 14h30 (mesma duração); depois foi para sexta
      v_criado := v_linha || jsonb_build_object(
        'data', '2026-10-08',
        'hora_inicio', '14:30:00',
        'hora_fim', case when r.hora_inicio is not null and r.hora_fim is not null
                         then ('14:30'::time + (r.hora_fim - r.hora_inicio))::text else null end);
      if v_quinta_quando is not null then
        v_alt := least(greatest(v_quinta_quando + interval '20 minutes', v_quando + interval '1 hour'),
                       v_limite - interval '1 hour');
      end if;
      v_campos := array['data', 'hora_fim', 'hora_inicio'];
      select jsonb_object_agg(k, v_criado -> k), jsonb_object_agg(k, v_linha -> k)
        into v_antes, v_depois from unnest(v_campos) k;

      insert into public.auditoria (criado_em, usuario_id, usuario_email, acao, tabela, registro_id, descricao, antes, depois, reconstruido)
      values (v_quando, v_uid, v_email, 'criou', 'palestras', r.id::text, r.titulo, null, v_criado, true);
      insert into public.auditoria (criado_em, usuario_id, usuario_email, acao, tabela, registro_id, descricao, campos, antes, depois, reconstruido)
      values (v_alt, v_uid, v_email, 'alterou', 'palestras', r.id::text, r.titulo, v_campos, v_antes, v_depois, true);

    else
      insert into public.auditoria (criado_em, usuario_id, usuario_email, acao, tabela, registro_id, descricao, antes, depois, reconstruido)
      values (v_quando, v_uid, v_email, 'criou', 'palestras', r.id::text, r.titulo, null, v_linha, true);
    end if;
  end loop;
end $$;

-- Remove a trava antiga que impedia desfazer esses registros e a função "apagar só os reconstruídos"
drop trigger if exists auditoria_bloquear_reconstruido on public.auditoria;
drop function if exists public.bloquear_desfazer_reconstruido();
drop function if exists public.apagar_reconstruidos();

-- Conferência: o que foi criado, em ordem
select to_char(criado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as quando,
       acao, tabela, descricao, campos
  from public.auditoria
 where reconstruido
 order by criado_em;
