ALTER TABLE public.detail_requests ADD COLUMN IF NOT EXISTS proposed_org text;
ALTER TABLE public.detail_requests DROP CONSTRAINT detail_requests_kind_check;
ALTER TABLE public.detail_requests ADD CONSTRAINT detail_requests_kind_check CHECK (kind IN ('presenter','name','email','confirm','affiliation'));

CREATE OR REPLACE FUNCTION public.request_affiliation_change(_org text, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p uuid; _id uuid; _o text := regexp_replace(btrim(coalesce(_org,'')), '\s+', ' ', 'g');
BEGIN
  SELECT id INTO _p FROM people WHERE user_id = auth.uid() LIMIT 1;
  IF _p IS NULL THEN RAISE EXCEPTION 'No pass linked to this sign-in yet'; END IF;
  IF length(_o) < 2 OR length(_o) > 200 THEN RAISE EXCEPTION 'Enter your institution name'; END IF;
  UPDATE detail_requests SET status = 'withdrawn', decided_at = now()
    WHERE person_id = _p AND kind = 'affiliation' AND status = 'pending';
  INSERT INTO detail_requests(user_id, person_id, kind, proposed_org, note)
  VALUES (auth.uid(), _p, 'affiliation', _o, nullif(btrim(coalesce(_note,'')),''))
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.request_affiliation_change(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_affiliation_change(text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.decide_detail_change(uuid, boolean, text, text);
CREATE FUNCTION public.decide_detail_change(_id uuid, _approve boolean, _note text, _name text DEFAULT NULL, _org text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r detail_requests; _old text; _new text; _canon text;
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
    ELSIF r.kind = 'affiliation' THEN
      _canon := btrim(coalesce(nullif(btrim(coalesce(_org,'')),''), r.proposed_org));
      INSERT INTO institution_aliases(raw, canonical, method) VALUES (r.proposed_org, _canon, 'manual')
        ON CONFLICT (raw) DO UPDATE SET canonical = EXCLUDED.canonical, method = 'manual', updated_at = now();
      UPDATE people SET organization_raw = r.proposed_org, organization = _canon, updated_at = now() WHERE id = r.person_id;
      _new := _canon;
    ELSE
      UPDATE people SET alt_email = r.proposed_email, updated_at = now() WHERE id = r.person_id;
    END IF;
  END IF;
  UPDATE detail_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    decision_note = nullif(btrim(coalesce(_note,'')),''), decided_by = auth.uid(), decided_at = now(),
    proposed_name = CASE WHEN _approve AND _new IS NOT NULL AND r.kind <> 'affiliation' THEN _new ELSE proposed_name END,
    proposed_org = CASE WHEN _approve AND r.kind = 'affiliation' THEN _new ELSE proposed_org END
  WHERE id = _id;
END $$;
REVOKE ALL ON FUNCTION public.decide_detail_change(uuid, boolean, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decide_detail_change(uuid, boolean, text, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.detail_queue();
CREATE FUNCTION public.detail_queue()
RETURNS TABLE(id uuid, kind text, status text, created_at timestamptz, decided_at timestamptz, author_index integer,
  proposed_name text, proposed_email text, proposed_org text, note text, decision_note text,
  code text, full_name text, email text, alt_email text, organization text,
  submission_code text, title text, authors jsonb, presenter_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'Organizers only'; END IF;
  RETURN QUERY SELECT d.id, d.kind, d.status, d.created_at, d.decided_at, d.author_index, d.proposed_name, d.proposed_email,
    d.proposed_org, d.note, d.decision_note, p.delegate_code, p.full_name, p.email, p.alt_email, p.organization,
    s.submission_code, s.title, s.authors, s.presenter_name
  FROM detail_requests d JOIN people p ON p.id = d.person_id LEFT JOIN submissions s ON s.id = d.submission_id
  WHERE d.status <> 'withdrawn'
  ORDER BY (d.status = 'pending') DESC, d.created_at DESC LIMIT 300;
END $$;
REVOKE ALL ON FUNCTION public.detail_queue() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.detail_queue() TO authenticated;