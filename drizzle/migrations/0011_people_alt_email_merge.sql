ALTER TABLE public.people ADD COLUMN IF NOT EXISTS alt_email text;
CREATE UNIQUE INDEX IF NOT EXISTS people_alt_email_uq ON public.people (alt_email) WHERE alt_email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.people_email_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  NEW.alt_email := NULLIF(lower(btrim(COALESCE(NEW.alt_email, ''))), '');
  NEW.delegate_code := upper(btrim(NEW.delegate_code));
  IF NEW.alt_email = NEW.email THEN NEW.alt_email := NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.people p WHERE p.id <> NEW.id
      AND (p.alt_email = NEW.email OR p.email = NEW.alt_email OR p.alt_email = NEW.alt_email)) THEN
    RAISE EXCEPTION 'That email is already on another profile' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t_people_email_guard ON public.people;
CREATE TRIGGER t_people_email_guard BEFORE INSERT OR UPDATE OF email, alt_email, delegate_code ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.people_email_guard();

CREATE OR REPLACE FUNCTION public.claim_my_person()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pid uuid; em text := lower(COALESCE(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL OR em = '' THEN RETURN NULL; END IF;
  SELECT id INTO pid FROM public.people WHERE user_id = auth.uid();
  IF pid IS NOT NULL THEN RETURN pid; END IF;
  UPDATE public.people SET user_id = auth.uid() WHERE (email = em OR alt_email = em) AND user_id IS NULL RETURNING id INTO pid;
  RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.merge_people(_keep uuid, _drop uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.people; d public.people;
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'organizers only'; END IF;
  IF _keep = _drop THEN RAISE EXCEPTION 'Pick two different profiles'; END IF;
  SELECT * INTO k FROM public.people WHERE id = _keep;
  SELECT * INTO d FROM public.people WHERE id = _drop;
  IF k.id IS NULL OR d.id IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  IF k.user_id IS NOT NULL AND d.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Both profiles are signed in with different accounts; remove one sign-in first';
  END IF;

  UPDATE public.person_roles r SET person_id = _keep WHERE person_id = _drop
    AND NOT EXISTS (SELECT 1 FROM public.person_roles x WHERE x.person_id = _keep AND x.role = r.role);
  DELETE FROM public.person_roles WHERE person_id = _keep AND role = 'visitor'
    AND EXISTS (SELECT 1 FROM public.person_roles x WHERE x.person_id = _keep AND x.role <> 'visitor');
  UPDATE public.person_connections c SET owner_person_id = _keep WHERE owner_person_id = _drop AND other_person_id <> _keep
    AND NOT EXISTS (SELECT 1 FROM public.person_connections x WHERE x.owner_person_id = _keep AND x.other_person_id = c.other_person_id);
  UPDATE public.person_connections c SET other_person_id = _keep WHERE other_person_id = _drop AND owner_person_id <> _keep
    AND NOT EXISTS (SELECT 1 FROM public.person_connections x WHERE x.other_person_id = _keep AND x.owner_person_id = c.owner_person_id);
  UPDATE public.person_bookmarks b SET target_person_id = _keep WHERE target_person_id = _drop
    AND NOT EXISTS (SELECT 1 FROM public.person_bookmarks x WHERE x.owner_user_id = b.owner_user_id AND x.target_person_id = _keep);
  UPDATE public.check_ins c SET person_id = _keep WHERE person_id = _drop
    AND (voided_at IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.check_ins x WHERE x.person_id = _keep AND x.event_day = c.event_day AND x.voided_at IS NULL));
  UPDATE public.registrations SET person_id = _keep WHERE person_id = _drop;
  UPDATE public.accommodations SET person_id = _keep WHERE person_id = _drop;
  UPDATE public.submission_people s SET person_id = _keep WHERE person_id = _drop
    AND NOT EXISTS (SELECT 1 FROM public.submission_people x WHERE x.person_id = _keep AND x.submission_id = s.submission_id AND x.role = s.role);

  DELETE FROM public.people WHERE id = _drop;
  UPDATE public.people SET
    user_id = COALESCE(k.user_id, d.user_id),
    alt_email = CASE WHEN k.alt_email IS NULL AND d.email NOT LIKE '%.local' THEN d.email ELSE k.alt_email END,
    phone = COALESCE(k.phone, d.phone),
    consent_networking = k.consent_networking OR d.consent_networking,
    consent_photo = k.consent_photo OR d.consent_photo,
    consent_whatsapp = k.consent_whatsapp OR d.consent_whatsapp,
    consent_calls = k.consent_calls OR d.consent_calls
  WHERE id = _keep;
  INSERT INTO public.audit_log(actor, table_name, row_id, action, diff)
    VALUES (auth.uid(), 'people', _keep, 'merge', jsonb_build_object('merged', to_jsonb(d)));
END $$;
REVOKE EXECUTE ON FUNCTION public.merge_people(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid) TO authenticated;

-- Sign-ins with no matching profile, for the console issues panel
CREATE OR REPLACE FUNCTION public.unmatched_signins()
RETURNS TABLE(user_id uuid, email text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'organizers only'; END IF;
  RETURN QUERY SELECT u.id, u.email::text, u.created_at FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.people p WHERE p.user_id = u.id
      OR p.email = lower(u.email) OR p.alt_email = lower(u.email))
    ORDER BY u.created_at DESC LIMIT 200;
END $$;
REVOKE EXECUTE ON FUNCTION public.unmatched_signins() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.unmatched_signins() TO authenticated;