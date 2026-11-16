ALTER TABLE public.people ADD COLUMN IF NOT EXISTS profile_links jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.set_my_profile_links(_links jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE clean jsonb;
BEGIN
  IF jsonb_typeof(_links) <> 'array' OR jsonb_array_length(_links) > 6 THEN RAISE EXCEPTION 'Up to 6 links'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('platform', left(e->>'platform', 24), 'url', left(e->>'url', 300))), '[]'::jsonb)
    INTO clean FROM jsonb_array_elements(_links) e
    WHERE (e->>'url') ~* '^https://[a-z0-9.-]+\.[a-z]{2,}(/|$)';
  UPDATE public.people SET profile_links = clean,
    linkedin_url = COALESCE((SELECT x->>'url' FROM jsonb_array_elements(clean) x WHERE x->>'platform' = 'linkedin' LIMIT 1), linkedin_url)
  WHERE user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.set_my_profile_links(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_my_profile_links(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.public_profile(_code text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN p.directory_opt_in THEN jsonb_build_object(
      'code', p.delegate_code, 'full_name', p.full_name, 'organization', p.organization,
      'linkedin_url', p.linkedin_url, 'profile_links', p.profile_links, 'email', CASE WHEN p.consent_networking THEN p.email END,
      'is_placeholder', p.is_placeholder, 'opted_in', true,
      'roles', COALESCE((SELECT jsonb_agg(DISTINCT r.role) FROM public.person_roles r WHERE r.person_id = p.id), '[]'::jsonb),
      'papers', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', s.submission_code, 'title', s.title, 'track', s.track, 'session_id', s.session_id))
         FROM public.submission_people sp JOIN public.submissions s ON s.id = sp.submission_id WHERE sp.person_id = p.id), '[]'::jsonb))
    ELSE jsonb_build_object('code', p.delegate_code, 'full_name', p.full_name, 'opted_in', false) END
  FROM public.people p WHERE upper(p.delegate_code) = upper(btrim(_code))
$function$;