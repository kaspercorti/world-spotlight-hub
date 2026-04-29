ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS content_hash text;

UPDATE public.incidents
SET content_hash = md5(
  lower(regexp_replace(coalesce(title,''), '[^a-zA-Z0-9]+', '', 'g'))
  || ':' || round(lat::numeric, 1)::text
  || ':' || round(lng::numeric, 1)::text
)
WHERE content_hash IS NULL;

DELETE FROM public.incidents a
USING public.incidents b
WHERE a.content_hash = b.content_hash
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS incidents_content_hash_uniq ON public.incidents (content_hash);