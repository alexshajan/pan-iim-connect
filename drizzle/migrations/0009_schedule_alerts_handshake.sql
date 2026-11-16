ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS import_batch text;
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS import_batch text;
CREATE INDEX IF NOT EXISTS sessions_import_batch_idx ON public.sessions(import_batch);

DROP TRIGGER IF EXISTS t_audit_sessions ON public.sessions;
CREATE TRIGGER t_audit_sessions AFTER INSERT OR UPDATE OR DELETE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.audit_row();
DROP TRIGGER IF EXISTS t_audit_announcements ON public.announcements;
CREATE TRIGGER t_audit_announcements AFTER INSERT OR UPDATE OR DELETE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.audit_row();

CREATE OR REPLACE FUNCTION public.card_status(_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'exists', true,
    'active', EXISTS (SELECT 1 FROM public.check_ins c WHERE c.person_id = p.id AND c.voided_at IS NULL),
    'is_self', p.user_id IS NOT NULL AND p.user_id = auth.uid())
  FROM public.people p WHERE upper(p.delegate_code) = upper(btrim(_code))
$$;
GRANT EXECUTE ON FUNCTION public.card_status(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_handshake(_code text, _medium text DEFAULT 'nfc')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me public.people; other public.people; src text;
BEGIN
  SELECT * INTO me FROM public.people WHERE user_id = auth.uid();
  IF me.id IS NULL THEN RAISE EXCEPTION 'Your pass is not linked yet'; END IF;
  SELECT * INTO other FROM public.people WHERE upper(delegate_code) = upper(btrim(_code));
  IF other.id IS NULL THEN RAISE EXCEPTION 'No delegate with that code'; END IF;
  IF other.id = me.id THEN RAISE EXCEPTION 'That is your own card'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.check_ins c WHERE c.person_id = other.id AND c.voided_at IS NULL) THEN
    RAISE EXCEPTION 'This card is not activated yet';
  END IF;
  src := CASE WHEN _medium IN ('qr','nfc') THEN _medium ELSE 'qr' END;
  INSERT INTO public.person_connections(owner_person_id, other_person_id, source) VALUES (me.id, other.id, src)
    ON CONFLICT (owner_person_id, other_person_id) DO NOTHING;
  INSERT INTO public.person_connections(owner_person_id, other_person_id, source) VALUES (other.id, me.id, src)
    ON CONFLICT (owner_person_id, other_person_id) DO NOTHING;
  RETURN jsonb_build_object(
    'full_name', other.full_name, 'organization', other.organization, 'code', other.delegate_code,
    'shared_keywords', COALESCE((SELECT jsonb_agg(k) FROM unnest(other.keywords) k WHERE lower(k) IN (SELECT lower(x) FROM unnest(me.keywords) x)), '[]'::jsonb),
    'shared_tracks', COALESCE((SELECT jsonb_agg(DISTINCT s1.track) FROM public.submission_people a JOIN public.submissions s1 ON s1.id = a.submission_id
        WHERE a.person_id = other.id AND s1.track IS NOT NULL AND s1.track IN (
          SELECT s2.track FROM public.submission_people b JOIN public.submissions s2 ON s2.id = b.submission_id WHERE b.person_id = me.id)), '[]'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.record_handshake(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_handshake(text, text) TO authenticated;