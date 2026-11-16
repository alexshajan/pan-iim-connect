CREATE TABLE public.network_waves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  to_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_person_id, to_person_id),
  CHECK (from_person_id <> to_person_id)
);
GRANT SELECT, DELETE ON public.network_waves TO authenticated;
GRANT ALL ON public.network_waves TO service_role;
ALTER TABLE public.network_waves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sender or receiver reads waves" ON public.network_waves FOR SELECT TO authenticated
  USING (from_person_id IN (SELECT id FROM public.people WHERE user_id = auth.uid())
      OR to_person_id IN (SELECT id FROM public.people WHERE user_id = auth.uid()));
CREATE POLICY "sender removes waves" ON public.network_waves FOR DELETE TO authenticated
  USING (from_person_id IN (SELECT id FROM public.people WHERE user_id = auth.uid()));

-- Wave only at directory-listed people; returns whether it is now mutual.
CREATE OR REPLACE FUNCTION public.send_wave(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid; other uuid; mutual boolean;
BEGIN
  SELECT id INTO me FROM public.people WHERE user_id = auth.uid();
  IF me IS NULL THEN RAISE EXCEPTION 'Your pass is not linked yet'; END IF;
  SELECT code_person INTO other FROM (SELECT p.id AS code_person FROM public.people p
    WHERE upper(p.delegate_code) = upper(btrim(_code))) x;
  IF other IS NULL OR NOT EXISTS (SELECT 1 FROM public.directory_people() d WHERE upper(d.code) = upper(btrim(_code))) THEN
    RAISE EXCEPTION 'That person is not in the directory'; END IF;
  IF other = me THEN RAISE EXCEPTION 'That is you'; END IF;
  INSERT INTO public.network_waves(from_person_id, to_person_id) VALUES (me, other) ON CONFLICT DO NOTHING;
  SELECT EXISTS (SELECT 1 FROM public.network_waves WHERE from_person_id = other AND to_person_id = me) INTO mutual;
  RETURN jsonb_build_object('mutual', mutual);
END $$;
REVOKE ALL ON FUNCTION public.send_wave(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_wave(text) TO authenticated;

-- My waves: codes I waved at, and codes that waved at me.
CREATE OR REPLACE FUNCTION public.my_waves()
RETURNS TABLE(code text, direction text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT id FROM public.people WHERE user_id = auth.uid())
  SELECT p.delegate_code, 'out', w.created_at FROM public.network_waves w JOIN public.people p ON p.id = w.to_person_id
    WHERE w.from_person_id IN (SELECT id FROM me)
  UNION ALL
  SELECT p.delegate_code, 'in', w.created_at FROM public.network_waves w JOIN public.people p ON p.id = w.from_person_id
    WHERE w.to_person_id IN (SELECT id FROM me)
$$;
REVOKE ALL ON FUNCTION public.my_waves() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_waves() TO authenticated;