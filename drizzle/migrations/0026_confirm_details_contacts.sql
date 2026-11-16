DROP FUNCTION IF EXISTS public.confirm_my_details();
CREATE FUNCTION public.confirm_my_details(_alt_email text DEFAULT NULL, _phone text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p uuid; _id uuid; _e text := lower(btrim(coalesce(_alt_email,''))); _ph text := btrim(coalesce(_phone,''));
BEGIN
  SELECT id INTO _p FROM people WHERE user_id = auth.uid() LIMIT 1;
  IF _p IS NULL THEN RAISE EXCEPTION 'No pass linked to this sign-in yet'; END IF;
  IF _e <> '' THEN
    IF _e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_e) > 200 THEN RAISE EXCEPTION 'That second email does not look right'; END IF;
    IF EXISTS (SELECT 1 FROM people WHERE id <> _p AND (email = _e OR lower(alt_email) = _e)) THEN
      RAISE EXCEPTION 'That email is on another pass. Ask the help desk to merge them.'; END IF;
    IF EXISTS (SELECT 1 FROM people WHERE id = _p AND email = _e) THEN RAISE EXCEPTION 'That is already your main email'; END IF;
    UPDATE people SET alt_email = _e WHERE id = _p;
  END IF;
  IF _ph <> '' THEN
    IF _ph !~ '^\+?[0-9 ()-]{7,20}$' THEN RAISE EXCEPTION 'That phone number does not look right'; END IF;
    UPDATE people SET phone = _ph WHERE id = _p;
  END IF;
  SELECT id INTO _id FROM detail_requests WHERE person_id = _p AND kind = 'confirm' AND status = 'approved' LIMIT 1;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO detail_requests(user_id, person_id, kind, status, decided_at) VALUES (auth.uid(), _p, 'confirm', 'approved', now()) RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.confirm_my_details(text, text) TO authenticated;