CREATE OR REPLACE FUNCTION public.merge_people(_keep uuid, _drop uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE k public.people; d public.people;
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'organizers only'; END IF;
  IF _keep = _drop THEN RAISE EXCEPTION 'Pick two different profiles'; END IF;
  SELECT * INTO k FROM public.people WHERE id = _keep;
  SELECT * INTO d FROM public.people WHERE id = _drop;
  IF k.id IS NULL OR d.id IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;

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
  -- Both signed in: the profile follows whichever account signed in most recently;
  -- claim_my_person() re-binds it when the person signs in with the other email.
  UPDATE public.people SET
    user_id = COALESCE(d.user_id, k.user_id),
    alt_email = CASE WHEN d.email NOT LIKE '%.local' AND d.email <> k.email THEN d.email ELSE k.alt_email END,
    phone = COALESCE(k.phone, d.phone),
    consent_networking = k.consent_networking OR d.consent_networking,
    consent_photo = k.consent_photo OR d.consent_photo,
    consent_whatsapp = k.consent_whatsapp OR d.consent_whatsapp,
    consent_calls = k.consent_calls OR d.consent_calls
  WHERE id = _keep;
  IF k.user_id IS NOT NULL AND d.user_id IS NOT NULL AND k.user_id <> d.user_id THEN
    UPDATE public.bookmarks b SET user_id = d.user_id WHERE user_id = k.user_id
      AND NOT EXISTS (SELECT 1 FROM public.bookmarks x WHERE x.user_id = d.user_id AND x.session_id = b.session_id);
  END IF;
  INSERT INTO public.audit_log(actor, table_name, row_id, action, diff)
    VALUES (auth.uid(), 'people', _keep, 'merge', jsonb_build_object('merged', to_jsonb(d)));
END $function$;

CREATE OR REPLACE FUNCTION public.claim_my_person()
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE pid uuid; old uuid; em text := lower(COALESCE(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL OR em = '' THEN RETURN NULL; END IF;
  SELECT id INTO pid FROM public.people WHERE user_id = auth.uid();
  IF pid IS NOT NULL THEN RETURN pid; END IF;
  -- The signed-in email is verified, so it may take over a profile listing it as main or second email.
  SELECT id, user_id INTO pid, old FROM public.people WHERE email = em OR alt_email = em
    ORDER BY (email = em) DESC LIMIT 1;
  IF pid IS NULL THEN RETURN NULL; END IF;
  UPDATE public.people SET user_id = auth.uid() WHERE id = pid;
  IF old IS NOT NULL AND old <> auth.uid() THEN
    UPDATE public.bookmarks b SET user_id = auth.uid() WHERE user_id = old
      AND NOT EXISTS (SELECT 1 FROM public.bookmarks x WHERE x.user_id = auth.uid() AND x.session_id = b.session_id);
  END IF;
  RETURN pid;
END $function$;