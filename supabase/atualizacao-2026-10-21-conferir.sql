-- Conferência (só leitura): o que já está ligado no banco. Pode rodar quantas vezes quiser.
select jsonb_build_object(
  'extensoes', (select coalesce(jsonb_agg(extname), '[]') from pg_extension where extname in ('pg_cron', 'pg_net')),
  'agendamentos', (select coalesce(jsonb_agg(jobname), '[]') from cron.job),
  'tabelas', (select jsonb_agg(table_name order by table_name) from information_schema.tables where table_schema = 'public'),
  'buckets', (select jsonb_agg(id) from storage.buckets),
  'assinantes', (select count(*) from public.subscriptions)
) as conferencia;
