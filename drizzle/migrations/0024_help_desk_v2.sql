ALTER TABLE public.help_requests ADD COLUMN IF NOT EXISTS resolution_note text;
ALTER TABLE public.help_requests ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.help_requests ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false;
ALTER TABLE public.help_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.help_requests ADD COLUMN IF NOT EXISTS seen_at timestamptz;

CREATE OR REPLACE FUNCTION public.help_queue()
RETURNS TABLE(id uuid, user_id uuid, category text, message text, location text, urgent boolean, status text,
  created_at timestamptz, updated_at timestamptz, resolved_at timestamptz, assigned_to uuid, resolution_note text,
  name text, contact text, person jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_organizer(auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['help_volunteer','volunteer','desk_volunteer'])) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN QUERY
  SELECT h.id, h.user_id, h.category, h.message, h.location, h.urgent, h.status, h.created_at, h.updated_at,
    h.resolved_at, h.assigned_to, h.resolution_note, h.name, h.contact,
    (SELECT jsonb_build_object(
      'code', p.delegate_code, 'full_name', p.full_name, 'organization', p.organization, 'email', p.email,
      'phone', CASE WHEN p.consent_calls THEN p.phone END, 'category', p.category,
      'roles', COALESCE((SELECT array_agg(r.role) FROM person_roles r WHERE r.person_id = p.id), '{}'),
      'stay', (SELECT a.residence || COALESCE(' ' || a.room_no, '') FROM accommodations a WHERE a.person_id = p.id LIMIT 1),
      'papers', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', s.submission_code, 'title', s.title, 'session_id', s.session_id))
         FROM submission_people sp JOIN submissions s ON s.id = sp.submission_id WHERE sp.person_id = p.id), '[]'),
      'checked_in', EXISTS (SELECT 1 FROM check_ins c WHERE c.person_id = p.id AND c.voided_at IS NULL),
      'past_requests', (SELECT count(*) FROM help_requests x WHERE x.user_id = h.user_id AND x.id <> h.id))
     FROM people p WHERE p.user_id = h.user_id AND h.user_id IS NOT NULL LIMIT 1)
  FROM help_requests h ORDER BY h.created_at DESC LIMIT 400;
END $$;
GRANT EXECUTE ON FUNCTION public.help_queue() TO authenticated;

CREATE OR REPLACE FUNCTION public.close_my_help(_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE help_requests SET status = 'resolved', resolved_at = now(), updated_at = now(),
    resolution_note = COALESCE(resolution_note, _note)
  WHERE id = _id AND user_id = auth.uid() AND status <> 'resolved';
END $$;
GRANT EXECUTE ON FUNCTION public.close_my_help(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_my_help(_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE help_requests SET status = 'open', resolved_at = NULL, updated_at = now(),
    message = message || E'\n\nFollow-up: ' || COALESCE(_note, 'Still need help')
  WHERE id = _id AND user_id = auth.uid() AND status = 'resolved';
END $$;
GRANT EXECUTE ON FUNCTION public.reopen_my_help(uuid, text) TO authenticated;