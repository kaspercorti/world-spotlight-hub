-- Extensions for scheduled jobs and HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Incidents table
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE NOT NULL,
  title text NOT NULL,
  summary text,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'tension',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  location text,
  country text,
  source text,
  source_url text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidents_occurred_at ON public.incidents (occurred_at DESC);
CREATE INDEX idx_incidents_type ON public.incidents (type);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Public read (this is a public live map)
CREATE POLICY "Incidents are publicly readable"
ON public.incidents
FOR SELECT
USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;