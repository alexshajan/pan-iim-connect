ALTER TABLE public.submissions
  ADD COLUMN presentation_mode text NOT NULL DEFAULT 'offline' CHECK (presentation_mode IN ('offline','online')),
  ADD COLUMN mode_status text NOT NULL DEFAULT 'confirmed' CHECK (mode_status IN ('confirmed','unconfirmed_default')),
  ADD COLUMN meeting_url text,
  ADD COLUMN contact_name text,
  ADD COLUMN contact_email text,
  ADD COLUMN slot_id uuid,
  ADD COLUMN room_id uuid;

ALTER TABLE public.submission_people
  ADD COLUMN author_order integer,
  ADD COLUMN is_presenter boolean NOT NULL DEFAULT false,
  ADD COLUMN affiliation text;

ALTER TABLE public.people
  ADD COLUMN attendance_mode text NOT NULL DEFAULT 'on_campus' CHECK (attendance_mode IN ('on_campus','remote')),
  ADD COLUMN email_missing boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX tracks_name_uq ON public.tracks(name);

CREATE TABLE public.programme_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL UNIQUE,
  label text NOT NULL,
  structure_note text,
  is_final boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE public.programme_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.programme_days(id) ON DELETE CASCADE,
  slot_no integer NOT NULL,
  label text,
  starts_at timestamptz,
  ends_at timestamptz,
  UNIQUE (day_id, slot_no)
);
CREATE TABLE public.programme_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_no integer NOT NULL UNIQUE,
  name text NOT NULL,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  capacity integer,
  is_hybrid boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.programme_days, public.programme_slots, public.programme_rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_days, public.programme_slots, public.programme_rooms TO authenticated;
GRANT ALL ON public.programme_days, public.programme_slots, public.programme_rooms TO service_role;
ALTER TABLE public.programme_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read days" ON public.programme_days FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write days" ON public.programme_days TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "public read slots" ON public.programme_slots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write slots" ON public.programme_slots TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "public read rooms" ON public.programme_rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write rooms" ON public.programme_rooms TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_slot_fk FOREIGN KEY (slot_id) REFERENCES public.programme_slots(id) ON DELETE SET NULL,
  ADD CONSTRAINT submissions_room_fk FOREIGN KEY (room_id) REFERENCES public.programme_rooms(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.refresh_attendance_modes()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.people p SET attendance_mode = CASE WHEN EXISTS (
      SELECT 1 FROM public.submission_people sp JOIN public.submissions s ON s.id = sp.submission_id
      WHERE sp.person_id = p.id AND s.presentation_mode = 'offline') THEN 'on_campus' ELSE 'remote' END
  WHERE EXISTS (SELECT 1 FROM public.submission_people sp WHERE sp.person_id = p.id);
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_attendance_modes() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_presentation_mode(_submission uuid, _mode text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _mode NOT IN ('offline','online') THEN RAISE EXCEPTION 'bad mode'; END IF;
  UPDATE public.submissions SET presentation_mode = _mode, mode_status = 'confirmed' WHERE id = _submission;
  UPDATE public.people p SET attendance_mode = CASE WHEN EXISTS (
      SELECT 1 FROM public.submission_people sp JOIN public.submissions s ON s.id = sp.submission_id
      WHERE sp.person_id = p.id AND s.presentation_mode = 'offline') THEN 'on_campus' ELSE 'remote' END
  WHERE p.id IN (SELECT person_id FROM public.submission_people WHERE submission_id = _submission);
END $$;
GRANT EXECUTE ON FUNCTION public.set_presentation_mode(uuid, text) TO authenticated;

CREATE OR REPLACE VIEW public.v_person_papers WITH (security_invoker = true) AS
  SELECT sp.person_id, sp.is_presenter, s.presentation_mode
  FROM public.submission_people sp JOIN public.submissions s ON s.id = sp.submission_id
  WHERE NOT s.is_placeholder;
REVOKE ALL ON public.v_person_papers FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.data_completeness()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  WITH s AS (SELECT * FROM public.submissions WHERE NOT is_placeholder),
  agg AS (
    SELECT person_id,
      count(*) AS papers,
      count(*) FILTER (WHERE is_presenter) AS presenting,
      bool_or(presentation_mode = 'offline') AS has_off,
      bool_or(presentation_mode = 'online') AS has_on,
      bool_or(is_presenter AND presentation_mode = 'offline') AS pres_off,
      bool_or(is_presenter AND presentation_mode = 'online') AS pres_on
    FROM public.v_person_papers GROUP BY person_id),
  au AS (SELECT p.email_missing, p.organization, p.phone, p.user_id, a.* FROM agg a JOIN public.people p ON p.id = a.person_id),
  tr AS (
    SELECT coalesce(track, '-') AS name, count(*) AS total,
      count(*) FILTER (WHERE presentation_mode = 'offline') AS offline,
      count(*) FILTER (WHERE presentation_mode = 'online') AS online,
      count(*) FILTER (WHERE mode_status = 'unconfirmed_default') AS unconfirmed
    FROM s GROUP BY track)
  SELECT jsonb_build_object(
    'papers', jsonb_build_object(
      'total', (SELECT count(*) FROM s),
      'offline', (SELECT count(*) FROM s WHERE presentation_mode = 'offline' AND mode_status = 'confirmed'),
      'online', (SELECT count(*) FROM s WHERE presentation_mode = 'online'),
      'unconfirmed', (SELECT count(*) FROM s WHERE mode_status = 'unconfirmed_default'),
      'no_presenter', (SELECT count(*) FROM s WHERE NOT EXISTS (SELECT 1 FROM public.submission_people x WHERE x.submission_id = s.id AND x.is_presenter)),
      'no_track', (SELECT count(*) FROM s WHERE coalesce(track, '') = ''),
      'unscheduled', (SELECT count(*) FROM s WHERE slot_id IS NULL OR room_id IS NULL),
      'online_no_link', (SELECT count(*) FROM s WHERE presentation_mode = 'online' AND coalesce(meeting_url, '') = '')),
    'presenters', jsonb_build_object(
      'total', (SELECT count(*) FROM au WHERE presenting > 0),
      'offline', (SELECT count(*) FROM au WHERE pres_off),
      'online', (SELECT count(*) FROM au WHERE pres_on),
      'both', (SELECT count(*) FROM au WHERE pres_off AND pres_on),
      'multi_paper', (SELECT count(*) FROM au WHERE presenting > 1),
      'no_email', (SELECT count(*) FROM au WHERE presenting > 0 AND email_missing),
      'signed_in', (SELECT count(*) FROM au WHERE presenting > 0 AND user_id IS NOT NULL)),
    'authors', jsonb_build_object(
      'total', (SELECT count(*) FROM au),
      'on_campus', (SELECT count(*) FROM au WHERE has_off),
      'remote', (SELECT count(*) FROM au WHERE NOT has_off),
      'mixed', (SELECT count(*) FROM au WHERE has_off AND has_on),
      'multi_paper', (SELECT count(*) FROM au WHERE papers > 1),
      'no_email', (SELECT count(*) FROM au WHERE email_missing),
      'no_affiliation', (SELECT count(*) FROM au WHERE coalesce(organization, '') = ''),
      'no_phone', (SELECT count(*) FROM au WHERE coalesce(phone, '') = ''),
      'signed_in', (SELECT count(*) FROM au WHERE user_id IS NOT NULL)),
    'tracks', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'total', total, 'offline', offline, 'online', online, 'unconfirmed', unconfirmed) ORDER BY total DESC), '[]'::jsonb) FROM tr),
    'scaffold', jsonb_build_object(
      'days', (SELECT count(*) FROM public.programme_days),
      'slots', (SELECT count(*) FROM public.programme_slots),
      'rooms', (SELECT count(*) FROM public.programme_rooms))
  ) INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.data_completeness() TO authenticated;