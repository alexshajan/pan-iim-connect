ALTER TABLE public.people ADD COLUMN IF NOT EXISTS directory_opt_in boolean NOT NULL DEFAULT true;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS linkedin_url text;

CREATE TABLE public.person_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  other_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  note text,
  source text NOT NULL DEFAULT 'code' CHECK (source IN ('qr','nfc','code')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_person_id, other_person_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_connections TO authenticated;
GRANT ALL ON public.person_connections TO service_role;
ALTER TABLE public.person_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages connections" ON public.person_connections FOR ALL TO authenticated
  USING (owner_person_id IN (SELECT id FROM public.people WHERE user_id = auth.uid()))
  WITH CHECK (owner_person_id IN (SELECT id FROM public.people WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.public_profile(_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p.directory_opt_in THEN jsonb_build_object(
      'code', p.delegate_code, 'full_name', p.full_name, 'organization', p.organization,
      'linkedin_url', p.linkedin_url, 'email', CASE WHEN p.consent_networking THEN p.email END,
      'is_placeholder', p.is_placeholder, 'opted_in', true,
      'roles', COALESCE((SELECT jsonb_agg(DISTINCT r.role) FROM public.person_roles r WHERE r.person_id = p.id), '[]'::jsonb),
      'papers', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', s.submission_code, 'title', s.title, 'track', s.track, 'session_id', s.session_id))
         FROM public.submission_people sp JOIN public.submissions s ON s.id = sp.submission_id WHERE sp.person_id = p.id), '[]'::jsonb))
    ELSE jsonb_build_object('code', p.delegate_code, 'full_name', p.full_name, 'opted_in', false) END
  FROM public.people p WHERE upper(p.delegate_code) = upper(btrim(_code))
$$;
GRANT EXECUTE ON FUNCTION public.public_profile(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_connection(_code text, _source text DEFAULT 'code')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid; other uuid; cid uuid;
BEGIN
  SELECT id INTO me FROM public.people WHERE user_id = auth.uid();
  IF me IS NULL THEN RAISE EXCEPTION 'Your pass is not linked yet'; END IF;
  SELECT id INTO other FROM public.people WHERE upper(delegate_code) = upper(btrim(_code));
  IF other IS NULL THEN RAISE EXCEPTION 'No delegate with that code'; END IF;
  IF other = me THEN RAISE EXCEPTION 'That is your own pass'; END IF;
  INSERT INTO public.person_connections(owner_person_id, other_person_id, source)
    VALUES (me, other, CASE WHEN _source IN ('qr','nfc','code') THEN _source ELSE 'code' END)
    ON CONFLICT (owner_person_id, other_person_id) DO UPDATE SET source = EXCLUDED.source
    RETURNING id INTO cid;
  RETURN cid;
END $$;
GRANT EXECUTE ON FUNCTION public.add_connection(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_connections()
RETURNS TABLE(id uuid, note text, source text, created_at timestamptz, code text, full_name text, organization text, email text, linkedin_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.note, c.source, c.created_at, o.delegate_code, o.full_name,
    CASE WHEN o.directory_opt_in THEN o.organization END,
    CASE WHEN o.directory_opt_in AND o.consent_networking THEN o.email END,
    CASE WHEN o.directory_opt_in THEN o.linkedin_url END
  FROM public.person_connections c JOIN public.people o ON o.id = c.other_person_id
  WHERE c.owner_person_id IN (SELECT p.id FROM public.people p WHERE p.user_id = auth.uid())
  ORDER BY c.created_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.my_connections() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_directory(_on boolean, _linkedin text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.people SET directory_opt_in = _on, linkedin_url = COALESCE(NULLIF(btrim(_linkedin), ''), linkedin_url)
  WHERE user_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.set_my_directory(boolean, text) TO authenticated;