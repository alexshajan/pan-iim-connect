ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS paper_target integer;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
UPDATE public.sessions s SET paper_target = c.n FROM (
  SELECT session_id, count(*)::int n FROM public.submissions WHERE session_id IS NOT NULL AND NOT is_placeholder GROUP BY session_id
) c WHERE c.session_id = s.id AND s.paper_target IS NULL;

CREATE OR REPLACE FUNCTION public.apply_slotter_moves(_moves jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m jsonb; cur uuid; dest uuid; n int := 0;
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'Only organizers can publish schedule changes'; END IF;
  FOR m IN SELECT * FROM jsonb_array_elements(_moves) LOOP
    dest := nullif(m->>'session_id','')::uuid;
    SELECT session_id INTO cur FROM submissions WHERE id = (m->>'id')::uuid;
    IF (cur IS DISTINCT FROM dest) AND EXISTS (SELECT 1 FROM sessions WHERE id IN (cur, dest) AND is_locked) THEN
      RAISE EXCEPTION 'Paper % touches a locked session', m->>'id';
    END IF;
    UPDATE submissions SET session_id = dest, session_order = nullif(m->>'order','')::int WHERE id = (m->>'id')::uuid;
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('applied', n);
END $$;
REVOKE ALL ON FUNCTION public.apply_slotter_moves(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_slotter_moves(jsonb) TO authenticated;