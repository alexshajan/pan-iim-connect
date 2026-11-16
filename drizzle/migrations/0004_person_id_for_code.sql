CREATE OR REPLACE FUNCTION public.person_id_for_code(_code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.people WHERE directory_opt_in AND upper(delegate_code) = upper(btrim(_code)) AND auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.person_id_for_code(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.person_id_for_code(text) TO authenticated;