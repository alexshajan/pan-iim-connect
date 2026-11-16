ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS session_code text,
  ADD COLUMN IF NOT EXISTS slot_code text,
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS room text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS parallel_track text;
CREATE UNIQUE INDEX IF NOT EXISTS sessions_session_code_key ON public.sessions(session_code) WHERE session_code IS NOT NULL;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS session_order integer,
  ADD COLUMN IF NOT EXISTS authors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS data_flag text;

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS organization_raw text,
  ADD COLUMN IF NOT EXISTS source_rows integer[] NOT NULL DEFAULT '{}';

-- Session chairs are organizer-only (no outreach to chairs from the guest app)
CREATE TABLE public.session_chairs (
  session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  chair text,
  co_chair text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_chairs TO authenticated;
GRANT ALL ON public.session_chairs TO service_role;
ALTER TABLE public.session_chairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organizers manage chairs" ON public.session_chairs FOR ALL TO authenticated
  USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));

-- Institution name standardisation: raw spelling -> standard name
CREATE TABLE public.institution_aliases (
  raw text PRIMARY KEY,
  canonical text NOT NULL,
  method text NOT NULL DEFAULT 'auto',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_aliases TO authenticated;
GRANT ALL ON public.institution_aliases TO service_role;
ALTER TABLE public.institution_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organizers manage aliases" ON public.institution_aliases FOR ALL TO authenticated
  USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));