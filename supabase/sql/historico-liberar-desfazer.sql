-- Para quem já rodou o historico-reconstruido.sql antigo:
-- libera o "Desfazer" nos registros de antes de 05/10 e remove a função "apagar só os reconstruídos"
-- (o histórico volta a ter um único botão "Apagar histórico", que apaga tudo).
drop trigger if exists auditoria_bloquear_reconstruido on public.auditoria;
drop function if exists public.bloquear_desfazer_reconstruido();
drop function if exists public.apagar_reconstruidos();

-- Conferência: não deve aparecer nenhuma linha
select tgname from pg_trigger where tgname = 'auditoria_bloquear_reconstruido';
