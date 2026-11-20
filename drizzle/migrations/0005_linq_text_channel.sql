CREATE TABLE public.linq_events (event_id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.linq_events TO service_role;
ALTER TABLE public.linq_events ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.linq_contacts (handle text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.linq_contacts TO service_role;
ALTER TABLE public.linq_contacts ENABLE ROW LEVEL SECURITY;