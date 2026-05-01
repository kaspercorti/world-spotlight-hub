
-- Table to store multiple media sources per incident
CREATE TABLE public.incident_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  source_name TEXT,
  source_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by incident
CREATE INDEX idx_incident_sources_incident_id ON public.incident_sources(incident_id);

-- Unique constraint to avoid duplicate URLs per incident
CREATE UNIQUE INDEX idx_incident_sources_uniq ON public.incident_sources(incident_id, source_url);

-- Enable RLS
ALTER TABLE public.incident_sources ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Sources are publicly readable"
ON public.incident_sources
FOR SELECT
USING (true);

-- Populate from existing incidents
INSERT INTO public.incident_sources (incident_id, source_name, source_url)
SELECT id, source, source_url
FROM public.incidents
WHERE source_url IS NOT NULL
ON CONFLICT DO NOTHING;
