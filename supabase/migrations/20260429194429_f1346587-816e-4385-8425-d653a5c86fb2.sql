-- Cron: ingest every 5 minutes
SELECT cron.schedule(
  'ingest-incidents-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://rfyqsjbgdygulrtaflpx.supabase.co/functions/v1/ingest-incidents',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

-- Cron: daily cleanup of old incidents (>7 days)
SELECT cron.schedule(
  'cleanup-old-incidents',
  '17 3 * * *',
  $$ DELETE FROM public.incidents WHERE occurred_at < now() - interval '7 days'; $$
);