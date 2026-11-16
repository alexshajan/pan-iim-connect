ALTER TABLE public.people ADD COLUMN IF NOT EXISTS card_role text, ADD COLUMN IF NOT EXISTS submission_ref text;

CREATE OR REPLACE FUNCTION public.card_is_team(_person uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.person_roles r WHERE r.person_id = _person
    AND r.role IN ('volunteer','organizer','steering_committee','co_convener','convener'))
$$;
REVOKE EXECUTE ON FUNCTION public.card_is_team(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.card_is_team(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.card_status(_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'exists', true,
    'active', public.card_is_team(p.id) OR EXISTS (SELECT 1 FROM public.check_ins c WHERE c.person_id = p.id AND c.voided_at IS NULL),
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
  IF NOT public.card_is_team(other.id) AND NOT EXISTS (SELECT 1 FROM public.check_ins c WHERE c.person_id = other.id AND c.voided_at IS NULL) THEN
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
    'shared_tracks', '[]'::jsonb);
END $$;
REVOKE EXECUTE ON FUNCTION public.record_handshake(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_handshake(text, text) TO authenticated;