-- Avisos diários (uma vez por dia, 9h de Brasília): teste acabando, Pix vencendo
-- e lembrete de parcela para a cliente final.
-- Antes: Database → Extensions → ligue "pg_cron" e "pg_net".
-- Troque SEU-PROJETO, SUA-CHAVE-PUBLICA (Settings → API → anon/publishable) e A-SENHA-DO-CRON
-- (a mesma do segredo CRON_SECRET da função "avisos"). Depois: SQL Editor → cole → Run.

select cron.unschedule(jobid) from cron.job where jobname = 'avisos-diarios' or command ilike '%/functions/v1/avisos%';

select cron.schedule(
  'avisos-diarios',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/avisos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'SUA-CHAVE-PUBLICA',
      'x-cron-secret', 'A-SENHA-DO-CRON'
    ),
    body := '{"tipo":"diario"}'::jsonb
  );
  $$
);

-- conferir: select jobname, schedule, active from cron.job;
