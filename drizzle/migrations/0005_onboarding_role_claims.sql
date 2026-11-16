ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE TABLE public.role_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  role text NOT NULL CHECK (role IN ('presenter','track_chair','reviewer','keynote','other')),
  submission_code text,
  note text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','rejected')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.role_claims TO authenticated;
GRANT ALL ON public.role_claims TO service_role;
ALTER TABLE public.role_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own claims read" ON public.role_claims FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_organizer(auth.uid()));
CREATE POLICY "own claims insert" ON public.role_claims FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'open');

CREATE OR REPLACE FUNCTION public.start_visitor_pass(_name text, _org text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; em text := lower(COALESCE(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL OR em = '' THEN RAISE EXCEPTION 'Sign in first'; END IF;
  pid := public.claim_my_person();
  IF pid IS NOT NULL THEN RETURN pid; END IF;
  INSERT INTO public.people(email, full_name, organization, category, user_id)
    VALUES (em, COALESCE(NULLIF(btrim(_name), ''), split_part(em, '@', 1)), NULLIF(btrim(_org), ''), 'Visitor', auth.uid())
    RETURNING id INTO pid;
  INSERT INTO public.person_roles(person_id, role) VALUES (pid, 'visitor');
  RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.complete_onboarding(_phone text, _photo boolean, _whatsapp boolean, _calls boolean, _networking boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  UPDATE public.people SET phone = COALESCE(NULLIF(btrim(_phone), ''), phone),
    consent_photo = _photo, consent_whatsapp = _whatsapp, consent_calls = _calls, consent_networking = _networking
    WHERE user_id = auth.uid();
  UPDATE public.profiles SET onboarded_at = now(), phone = NULLIF(btrim(_phone), '') WHERE id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.resolve_role_claim(_claim uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.role_claims; pid uuid; sid uuid;
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'organizers only'; END IF;
  SELECT * INTO c FROM public.role_claims WHERE id = _claim;
  IF c.id IS NULL THEN RAISE EXCEPTION 'claim not found'; END IF;
  IF _approve THEN
    SELECT id INTO pid FROM public.people WHERE user_id = c.user_id;
    IF pid IS NOT NULL THEN
      DELETE FROM public.person_roles WHERE person_id = pid AND role = 'visitor';
      IF NOT EXISTS (SELECT 1 FROM public.person_roles WHERE person_id = pid AND role = c.role) THEN
        INSERT INTO public.person_roles(person_id, role) VALUES (pid, c.role);
      END IF;
      UPDATE public.people SET category = NULL WHERE id = pid AND category = 'Visitor';
      IF c.submission_code IS NOT NULL THEN
        SELECT id INTO sid FROM public.submissions WHERE upper(submission_code) = upper(btrim(c.submission_code));
        IF sid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.submission_people WHERE submission_id = sid AND person_id = pid) THEN
          INSERT INTO public.submission_people(submission_id, person_id, role) VALUES (sid, pid, 'presenter');
        END IF;
      END IF;
    END IF;
  END IF;
  UPDATE public.role_claims SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    resolved_by = auth.uid(), resolved_at = now() WHERE id = _claim;
END $$;

REVOKE EXECUTE ON FUNCTION public.start_visitor_pass(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.complete_onboarding(text, boolean, boolean, boolean, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.resolve_role_claim(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.start_visitor_pass(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, boolean, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_role_claim(uuid, boolean) TO authenticated;