CREATE OR REPLACE FUNCTION public.set_my_profile_links(_links jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE clean jsonb;
BEGIN
  IF jsonb_typeof(_links) <> 'array' OR jsonb_array_length(_links) > 6 THEN RAISE EXCEPTION 'Up to 6 links'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('platform', left(e->>'platform', 24), 'url', left(e->>'url', 300))), '[]'::jsonb)
    INTO clean FROM jsonb_array_elements(_links) e
    WHERE (e->>'url') ~* '^https://[a-z0-9.-]+\.[a-z]{2,}(/|$)';
  UPDATE public.people SET
    linkedin_url = CASE
      WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(clean) x WHERE x->>'platform' = 'linkedin')
        THEN (SELECT x->>'url' FROM jsonb_array_elements(clean) x WHERE x->>'platform' = 'linkedin' LIMIT 1)
      WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(profile_links, '[]'::jsonb)) x WHERE x->>'platform' = 'linkedin')
        OR linkedin_url IN (SELECT x->>'url' FROM jsonb_array_elements(COALESCE(profile_links, '[]'::jsonb)) x)
        THEN NULL
      ELSE linkedin_url END,
    profile_links = clean
  WHERE user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.set_my_profile_links(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_my_profile_links(jsonb) TO authenticated;