CREATE TABLE public.detail_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('presenter','name','email')),
  author_index integer,
  proposed_name text,
  proposed_email text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.detail_requests TO authenticated;
GRANT ALL ON public.detail_requests TO service_role;
ALTER TABLE public.detail_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or organizer read" ON public.detail_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_organizer(auth.uid()));
CREATE INDEX detail_requests_person_idx ON public.detail_requests(person_id, status);

-- Papers linked to the signed-in person, with the accepted author list
CREATE OR REPLACE FUNCTION public.my_paper_authors()
RETURNS TABLE(submission_id uuid, submission_code text, title text, presenter_name text, authors jsonb, my_order integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.submission_code, s.title, s.presenter_name, s.authors, sp.author_order
  FROM people p
  JOIN submission_people sp ON sp.person_id = p.id
  JOIN submissions s ON s.id = sp.submission_id
  WHERE p.user_id = auth.uid() AND s.is_placeholder = false
  ORDER BY s.submission_code
$$;
REVOKE ALL ON FUNCTION public.my_paper_authors() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_paper_authors() TO authenticated;

CREATE OR REPLACE FUNCTION public.request_detail_change(_kind text, _submission uuid, _author_index integer, _name text, _email text, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p uuid; _id uuid; _authors jsonb; _e text := lower(btrim(coalesce(_email,'')));
BEGIN
  SELECT id INTO _p FROM people WHERE user_id = auth.uid() LIMIT 1;
  IF _p IS NULL THEN RAISE EXCEPTION 'No pass linked to this sign-in yet'; END IF;
  IF _kind NOT IN ('presenter','name','email') THEN RAISE EXCEPTION 'Unknown request'; END IF;
  IF _kind = 'presenter' THEN
    SELECT s.authors INTO _authors FROM submissions s JOIN submission_people sp ON sp.submission_id = s.id
      WHERE s.id = _submission AND sp.person_id = _p;
    IF _authors IS NULL THEN RAISE EXCEPTION 'That paper is not linked to you'; END IF;
    IF _author_index IS NULL OR _author_index < 1 OR _author_index > jsonb_array_length(_authors) THEN
      RAISE EXCEPTION 'Pick a name from the author list'; END IF;
  ELSIF _kind = 'name' THEN
    IF length(btrim(coalesce(_name,''))) < 2 OR length(_name) > 120 THEN RAISE EXCEPTION 'Enter your name as it should print'; END IF;
  ELSE
    IF _e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_e) > 200 THEN RAISE EXCEPTION 'That email does not look right'; END IF;
    IF EXISTS (SELECT 1 FROM people WHERE id <> _p AND (email = _e OR lower(alt_email) = _e)) THEN
      RAISE EXCEPTION 'That email is on another pass. Ask the help desk to merge them.'; END IF;
  END IF;
  UPDATE detail_requests SET status = 'withdrawn', decided_at = now()
    WHERE person_id = _p AND kind = _kind AND status = 'pending'
      AND (submission_id IS NOT DISTINCT FROM CASE WHEN _kind = 'presenter' THEN _submission END);
  INSERT INTO detail_requests(user_id, person_id, submission_id, kind, author_index, proposed_name, proposed_email, note)
  VALUES (auth.uid(), _p, CASE WHEN _kind = 'presenter' THEN _submission END,
    _kind, CASE WHEN _kind = 'presenter' THEN _author_index END,
    CASE WHEN _kind = 'presenter' THEN _authors -> (_author_index - 1) ->> 'name' WHEN _kind = 'name' THEN btrim(_name) END,
    CASE WHEN _kind = 'email' THEN _e END, nullif(btrim(coalesce(_note,'')),''))
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.request_detail_change(text, uuid, integer, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_detail_change(text, uuid, integer, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.withdraw_detail_change(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE detail_requests SET status = 'withdrawn', decided_at = now()
  WHERE id = _id AND user_id = auth.uid() AND status = 'pending'
$$;
REVOKE ALL ON FUNCTION public.withdraw_detail_change(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_detail_change(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_detail_change(_id uuid, _approve boolean, _note text, _name text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r detail_requests; _old text; _new text;
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'Organizers only'; END IF;
  SELECT * INTO r FROM detail_requests WHERE id = _id FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'pending' THEN RAISE EXCEPTION 'Already decided'; END IF;
  IF NOT _approve AND length(btrim(coalesce(_note,''))) = 0 THEN RAISE EXCEPTION 'Add a short reason so they know what to fix'; END IF;
  IF _approve THEN
    SELECT full_name INTO _old FROM people WHERE id = r.person_id;
    IF r.kind IN ('presenter','name') THEN
      _new := btrim(coalesce(nullif(btrim(coalesce(_name,'')),''), regexp_replace(r.proposed_name, '^\s*(dr|prof|mr|ms|mrs)\.?\s+', '', 'i')));
      UPDATE people SET full_name = _new, updated_at = now() WHERE id = r.person_id;
      UPDATE submissions s SET presenter_name = _new, updated_at = now()
        FROM submission_people sp WHERE sp.submission_id = s.id AND sp.person_id = r.person_id
          AND (s.id = r.submission_id OR lower(btrim(coalesce(s.presenter_name,''))) = lower(btrim(_old)));
      IF r.kind = 'presenter' THEN
        UPDATE submission_people SET author_order = r.author_index, is_presenter = true
          WHERE submission_id = r.submission_id AND person_id = r.person_id;
      END IF;
    ELSE
      UPDATE people SET alt_email = r.proposed_email, updated_at = now() WHERE id = r.person_id;
    END IF;
  END IF;
  UPDATE detail_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    decision_note = nullif(btrim(coalesce(_note,'')),''), decided_by = auth.uid(), decided_at = now(),
    proposed_name = CASE WHEN _approve AND _new IS NOT NULL THEN _new ELSE proposed_name END
  WHERE id = _id;
END $$;
REVOKE ALL ON FUNCTION public.decide_detail_change(uuid, boolean, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decide_detail_change(uuid, boolean, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.detail_queue()
RETURNS TABLE(id uuid, kind text, status text, created_at timestamptz, decided_at timestamptz, author_index integer,
  proposed_name text, proposed_email text, note text, decision_note text,
  code text, full_name text, email text, alt_email text, organization text,
  submission_code text, title text, authors jsonb, presenter_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'Organizers only'; END IF;
  RETURN QUERY SELECT d.id, d.kind, d.status, d.created_at, d.decided_at, d.author_index, d.proposed_name, d.proposed_email,
    d.note, d.decision_note, p.delegate_code, p.full_name, p.email, p.alt_email, p.organization,
    s.submission_code, s.title, s.authors, s.presenter_name
  FROM detail_requests d JOIN people p ON p.id = d.person_id LEFT JOIN submissions s ON s.id = d.submission_id
  WHERE d.status <> 'withdrawn'
  ORDER BY (d.status = 'pending') DESC, d.created_at DESC LIMIT 300;
END $$;
REVOKE ALL ON FUNCTION public.detail_queue() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.detail_queue() TO authenticated;