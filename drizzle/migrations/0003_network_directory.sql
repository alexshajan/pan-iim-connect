ALTER TABLE public.people ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS bio text;

CREATE TABLE public.person_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  target_person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((target_person_id IS NULL) <> (submission_id IS NULL))
);
CREATE UNIQUE INDEX person_bookmarks_person_uq ON public.person_bookmarks(owner_user_id, target_person_id) WHERE target_person_id IS NOT NULL;
CREATE UNIQUE INDEX person_bookmarks_sub_uq ON public.person_bookmarks(owner_user_id, submission_id) WHERE submission_id IS NOT NULL;
GRANT SELECT, INSERT, DELETE ON public.person_bookmarks TO authenticated;
GRANT ALL ON public.person_bookmarks TO service_role;
ALTER TABLE public.person_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bookmarks" ON public.person_bookmarks FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.directory_people()
RETURNS TABLE(code text, full_name text, organization text, keywords text[], bio text, linkedin_url text, email text, is_placeholder boolean, roles text[], papers jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.delegate_code, p.full_name, p.organization, p.keywords, p.bio, p.linkedin_url,
    CASE WHEN p.consent_networking THEN p.email END, p.is_placeholder,
    COALESCE((SELECT array_agg(DISTINCT r.role) FROM public.person_roles r WHERE r.person_id = p.id), '{}'),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'code', s.submission_code, 'title', s.title, 'track', s.track, 'session_id', s.session_id))
      FROM public.submission_people sp JOIN public.submissions s ON s.id = sp.submission_id WHERE sp.person_id = p.id), '[]'::jsonb)
  FROM public.people p
  WHERE p.directory_opt_in AND auth.uid() IS NOT NULL
  ORDER BY p.full_name
$$;
REVOKE ALL ON FUNCTION public.directory_people() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.directory_people() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_profile(_keywords text[], _bio text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.people SET keywords = (SELECT COALESCE(array_agg(k), '{}') FROM (SELECT DISTINCT lower(btrim(k)) k FROM unnest(_keywords) k WHERE btrim(k) <> '' LIMIT 8) x),
    bio = NULLIF(left(btrim(_bio), 160), '')
  WHERE user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.set_my_profile(text[], text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_my_profile(text[], text) TO authenticated;