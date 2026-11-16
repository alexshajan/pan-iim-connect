CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = ANY(_roles))
$$;

-- Check-ins
CREATE TABLE public.check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  event_day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  by_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  method text NOT NULL DEFAULT 'qr' CHECK (method IN ('qr','manual')),
  voided_at timestamptz,
  voided_by uuid,
  is_placeholder boolean NOT NULL DEFAULT false,
  placeholder_batch text
);
CREATE UNIQUE INDEX check_ins_one_per_day ON public.check_ins(person_id, event_day) WHERE voided_at IS NULL;
GRANT SELECT ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "desk and organizers read check-ins" ON public.check_ins FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor','desk_volunteer']));
CREATE POLICY "own check-ins" ON public.check_ins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_id AND p.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.checkin_lookup(_q text)
RETURNS TABLE(person_id uuid, delegate_code text, full_name text, organization text, category text,
  claimed boolean, roles text[], papers text[], checked_in_at timestamptz, checked_in_by text, check_in_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE q text := trim(_q);
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','editor','desk_volunteer']) THEN RAISE EXCEPTION 'forbidden'; END IF;
  -- accept full pass URLs like https://.../id/WMC-XXXX
  IF q ~* '/id/' THEN q := regexp_replace(q, '^.*/id/([^/?#]+).*$', '\1'); END IF;
  RETURN QUERY
  SELECT p.id, p.delegate_code, p.full_name, p.organization, p.category, p.user_id IS NOT NULL,
    COALESCE((SELECT array_agg(r.role) FROM person_roles r WHERE r.person_id = p.id), '{}'),
    COALESCE((SELECT array_agg(s.submission_code) FROM submission_people sp JOIN submissions s ON s.id = sp.submission_id WHERE sp.person_id = p.id), '{}'),
    c.checked_in_at,
    (SELECT pp.full_name FROM people pp WHERE pp.user_id = c.by_user LIMIT 1),
    c.id
  FROM people p
  LEFT JOIN check_ins c ON c.person_id = p.id AND c.voided_at IS NULL AND c.event_day = (now() AT TIME ZONE 'Asia/Kolkata')::date
  WHERE upper(p.delegate_code) = upper(q) OR (length(q) >= 3 AND (p.full_name ILIKE '%'||q||'%' OR p.email ILIKE q||'%'))
  ORDER BY (upper(p.delegate_code) = upper(q)) DESC, p.full_name
  LIMIT 8;
END $$;

CREATE OR REPLACE FUNCTION public.check_in_person(_person_id uuid, _method text DEFAULT 'qr')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing check_ins; new_id uuid;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','editor','desk_volunteer']) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO existing FROM check_ins WHERE person_id = _person_id AND voided_at IS NULL
    AND event_day = (now() AT TIME ZONE 'Asia/Kolkata')::date;
  IF FOUND THEN
    RETURN jsonb_build_object('status','already','id',existing.id,'at',existing.checked_in_at);
  END IF;
  INSERT INTO check_ins(person_id, by_user, method) VALUES (_person_id, auth.uid(), CASE WHEN _method='manual' THEN 'manual' ELSE 'qr' END)
    RETURNING id INTO new_id;
  INSERT INTO audit_log(actor, table_name, row_id, action, diff) VALUES (auth.uid(), 'check_ins', new_id, 'CHECK_IN', jsonb_build_object('person_id', _person_id));
  RETURN jsonb_build_object('status','ok','id',new_id,'at',now());
END $$;

CREATE OR REPLACE FUNCTION public.void_check_in(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE check_ins SET voided_at = now(), voided_by = auth.uid() WHERE id = _id AND voided_at IS NULL;
  INSERT INTO audit_log(actor, table_name, row_id, action) VALUES (auth.uid(), 'check_ins', _id, 'VOID');
END $$;

-- Team / roles
CREATE OR REPLACE FUNCTION public.console_team()
RETURNS TABLE(user_id uuid, email text, full_name text, roles text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT u.id, u.email::text, (SELECT p.full_name FROM people p WHERE p.user_id = u.id LIMIT 1),
    array_agg(r.role::text ORDER BY r.role::text)
  FROM user_roles r JOIN auth.users u ON u.id = r.user_id GROUP BY u.id, u.email ORDER BY u.email;
END $$;

CREATE OR REPLACE FUNCTION public.set_user_roles(_email text, _roles text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(trim(_email));
  IF uid IS NULL THEN RETURN jsonb_build_object('status','no_account'); END IF;
  IF uid = auth.uid() AND NOT ('admin' = ANY(_roles)) THEN RAISE EXCEPTION 'You cannot remove your own admin role'; END IF;
  DELETE FROM user_roles WHERE user_id = uid AND NOT (role::text = ANY(_roles));
  INSERT INTO user_roles(user_id, role) SELECT uid, r::app_role FROM unnest(_roles) r ON CONFLICT DO NOTHING;
  INSERT INTO audit_log(actor, table_name, row_id, action, diff) VALUES (auth.uid(), 'user_roles', uid, 'SET_ROLES', jsonb_build_object('roles', _roles));
  RETURN jsonb_build_object('status','ok');
END $$;

-- Help queue for help volunteers
ALTER TABLE public.help_requests ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.help_requests ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
CREATE POLICY "help volunteers read help" ON public.help_requests FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['help_volunteer','volunteer']));
CREATE POLICY "help volunteers update help" ON public.help_requests FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['help_volunteer','volunteer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['help_volunteer','volunteer']));

-- Settings
CREATE TABLE public.console_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.console_settings TO authenticated;
GRANT ALL ON public.console_settings TO service_role;
ALTER TABLE public.console_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read settings" ON public.console_settings FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor','desk_volunteer','room_volunteer','help_volunteer','volunteer']));
CREATE POLICY "organizers write settings" ON public.console_settings FOR ALL TO authenticated
  USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
INSERT INTO public.console_settings(key, value) VALUES ('deck_grouping', '"room"') ON CONFLICT DO NOTHING;

-- Slide decks
CREATE TABLE public.submission_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  version int NOT NULL DEFAULT 1,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  is_placeholder boolean NOT NULL DEFAULT false,
  placeholder_batch text
);
GRANT SELECT, INSERT, DELETE ON public.submission_decks TO authenticated;
GRANT ALL ON public.submission_decks TO service_role;
ALTER TABLE public.submission_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deck readers" ON public.submission_decks FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor','room_volunteer']));
CREATE POLICY "organizers write decks" ON public.submission_decks FOR INSERT TO authenticated
  WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "organizers delete decks" ON public.submission_decks FOR DELETE TO authenticated
  USING (public.is_organizer(auth.uid()));

CREATE OR REPLACE FUNCTION public.deck_drive()
RETURNS TABLE(submission_id uuid, submission_code text, title text, track text, presenter_name text,
  session_title text, starts_at timestamptz, venue text, deck_id uuid, file_path text, file_name text, version int, uploaded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','editor','room_volunteer']) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT s.id, s.submission_code, s.title, s.track, s.presenter_name, se.title, se.starts_at,
    COALESCE(v.short_name, v.name), d.id, d.file_path, d.file_name, d.version, d.uploaded_at
  FROM submissions s
  LEFT JOIN sessions se ON se.id = s.session_id
  LEFT JOIN venues v ON v.id = se.venue_id
  LEFT JOIN LATERAL (SELECT * FROM submission_decks x WHERE x.submission_id = s.id ORDER BY x.version DESC LIMIT 1) d ON true
  ORDER BY se.starts_at NULLS LAST, s.submission_code;
END $$;