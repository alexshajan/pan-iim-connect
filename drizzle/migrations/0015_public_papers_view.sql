CREATE OR REPLACE VIEW public.public_papers
WITH (security_invoker = false) AS
SELECT s.id, s.session_id, s.submission_code, s.title, s.presenter_name, s.session_order, s.presentation_mode, s.authors
FROM public.submissions s
WHERE s.session_id IS NOT NULL AND s.is_placeholder = false;
COMMENT ON VIEW public.public_papers IS 'Guest-safe paper list for the Calendar: titles, author names and institutions only; no contact, payment or meeting details.';
GRANT SELECT ON public.public_papers TO anon, authenticated;
GRANT ALL ON public.public_papers TO service_role;