-- Signed-in guests can see which paper authors have an app profile (name + delegate code only).
CREATE OR REPLACE FUNCTION public.paper_author_links()
 RETURNS TABLE(submission_id uuid, full_name text, code text, is_presenter boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT sp.submission_id, p.full_name, p.delegate_code, sp.is_presenter
  FROM submission_people sp
  JOIN people p ON p.id = sp.person_id
  JOIN submissions s ON s.id = sp.submission_id
  WHERE auth.uid() IS NOT NULL AND s.session_id IS NOT NULL
    AND s.is_placeholder = false AND p.is_placeholder = false AND p.delegate_code IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.paper_author_links() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.paper_author_links() TO authenticated;
