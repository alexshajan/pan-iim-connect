CREATE OR REPLACE VIEW public.public_papers
WITH (security_invoker = false) AS
SELECT s.id, s.session_id, s.submission_code, s.title, s.presenter_name, s.session_order, s.presentation_mode,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('name', a->>'name', 'org', COALESCE(ia.canonical, a->>'org')) ORDER BY ord)
    FROM jsonb_array_elements(s.authors) WITH ORDINALITY AS t(a, ord)
    LEFT JOIN public.institution_aliases ia ON ia.raw = a->>'org'
  ), '[]'::jsonb) AS authors
FROM public.submissions s
WHERE s.session_id IS NOT NULL AND s.is_placeholder = false;
GRANT SELECT ON public.public_papers TO anon, authenticated;