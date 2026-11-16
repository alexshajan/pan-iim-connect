ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS in_everyone_plan boolean NOT NULL DEFAULT false;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS moved_at timestamptz;

CREATE OR REPLACE FUNCTION public.sessions_mark_moved() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.venue_id IS DISTINCT FROM OLD.venue_id OR NEW.room IS DISTINCT FROM OLD.room) THEN
    NEW.moved_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sessions_mark_moved ON public.sessions;
CREATE TRIGGER sessions_mark_moved BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.sessions_mark_moved();

CREATE TABLE public.alert_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  urgent boolean NOT NULL DEFAULT false,
  kind text NOT NULL DEFAULT 'update',
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  ends_at timestamptz,
  requested_by uuid NOT NULL DEFAULT auth.uid(),
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  announcement_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.alert_requests TO authenticated;
GRANT ALL ON public.alert_requests TO service_role;
ALTER TABLE public.alert_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "volunteers request alerts" ON public.alert_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND status = 'pending'
    AND public.has_any_role(auth.uid(), ARRAY['volunteer','desk_volunteer','room_volunteer','help_volunteer','editor','admin']));
CREATE POLICY "own or organizer read requests" ON public.alert_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.is_organizer(auth.uid()));

CREATE OR REPLACE FUNCTION public.decide_alert_request(_id uuid, _approve boolean, _title text, _body text, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.alert_requests; ann uuid; who text;
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'Only organizers can decide'; END IF;
  SELECT * INTO r FROM public.alert_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN
    SELECT coalesce(p.full_name, u.email) INTO who FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = r.decided_by;
    RETURN jsonb_build_object('already', true, 'status', r.status, 'by', who, 'at', r.decided_at);
  END IF;
  IF _approve THEN
    INSERT INTO public.announcements (title, body, audience, urgent, kind, session_id, ends_at, created_by)
    VALUES (coalesce(nullif(_title,''), r.title), coalesce(nullif(_body,''), r.body), r.audience, r.urgent, r.kind, r.session_id, r.ends_at, r.requested_by)
    RETURNING id INTO ann;
  END IF;
  UPDATE public.alert_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    title = coalesce(nullif(_title,''), title), body = coalesce(nullif(_body,''), body),
    decided_by = auth.uid(), decided_at = now(), decision_note = _note, announcement_id = ann
  WHERE id = _id;
  RETURN jsonb_build_object('already', false, 'status', CASE WHEN _approve THEN 'approved' ELSE 'rejected' END);
END $$;
GRANT EXECUTE ON FUNCTION public.decide_alert_request(uuid, boolean, text, text, text) TO authenticated;