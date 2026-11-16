-- Core people registry: people, roles, registrations, submissions, accommodations, imports, review queue, audit.

CREATE OR REPLACE FUNCTION public.gen_delegate_code()
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; code text; i int;
BEGIN
  LOOP
    code := 'WMC-';
    FOR i IN 1..4 LOOP
      code := code || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.people WHERE delegate_code = code);
  END LOOP;
  RETURN code;
END $$;

CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  rolled_back_at timestamptz
);

CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegate_code text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text,
  organization text,
  address text,
  category text,
  user_id uuid UNIQUE,
  consent_networking boolean NOT NULL DEFAULT false,
  consent_photo boolean NOT NULL DEFAULT false,
  consent_whatsapp boolean NOT NULL DEFAULT false,
  consent_calls boolean NOT NULL DEFAULT false,
  notes text,
  created_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL,
  is_placeholder boolean NOT NULL DEFAULT false,
  placeholder_batch text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.people_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  IF NEW.delegate_code IS NULL OR NEW.delegate_code = '' THEN
    NEW.delegate_code := public.gen_delegate_code();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER t_people_before_insert BEFORE INSERT ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.people_before_insert();
CREATE TRIGGER t_people_updated BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.person_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role text NOT NULL,
  is_placeholder boolean NOT NULL DEFAULT false,
  placeholder_batch text,
  UNIQUE (person_id, role)
);

CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  source_row integer,
  payment_status text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_placeholder boolean NOT NULL DEFAULT false,
  placeholder_batch text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_code text NOT NULL UNIQUE,
  title text,
  abstract text,
  track text,
  presenter_name text,
  payment_status text,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  created_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL,
  is_placeholder boolean NOT NULL DEFAULT false,
  placeholder_batch text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER t_submissions_updated BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.submission_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'author',
  is_placeholder boolean NOT NULL DEFAULT false,
  placeholder_batch text,
  UNIQUE (submission_id, person_id, role)
);

CREATE TABLE public.accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  residence text NOT NULL,
  room_no text,
  check_in date,
  check_out date,
  is_placeholder boolean NOT NULL DEFAULT false,
  placeholder_batch text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  person_ids uuid[] NOT NULL DEFAULT '{}',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid,
  table_name text NOT NULL,
  row_id uuid,
  action text NOT NULL,
  diff jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_registrations_person ON public.registrations(person_id);
CREATE INDEX idx_registrations_batch ON public.registrations(batch_id);
CREATE INDEX idx_subpeople_person ON public.submission_people(person_id);
CREATE INDEX idx_accom_person ON public.accommodations(person_id);
CREATE INDEX idx_audit_row ON public.audit_log(row_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches, public.people, public.person_roles,
  public.registrations, public.submissions, public.submission_people, public.accommodations,
  public.review_items TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.import_batches, public.people, public.person_roles, public.registrations,
  public.submissions, public.submission_people, public.accommodations, public.review_items,
  public.audit_log TO service_role;

-- RLS
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizers manage batches" ON public.import_batches FOR ALL TO authenticated
  USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "organizers manage people" ON public.people FOR ALL TO authenticated
  USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "read own person" ON public.people FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "organizers manage roles" ON public.person_roles FOR ALL TO authenticated
  USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "read own person roles" ON public.person_roles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_id AND p.user_id = auth.uid()));
CREATE POLICY "organizers manage registrations" ON public.registrations FOR ALL TO authenticated
  USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "organizers manage submissions" ON public.submissions FOR ALL TO authenticated
  USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "read own submissions" ON public.submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submission_people sp JOIN public.people p ON p.id = sp.person_id
    WHERE sp.submission_id = submissions.id AND p.user_id = auth.uid()));
CREATE POLICY "organizers manage submission people" ON public.submission_people FOR ALL TO authenticated
  USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "read own submission links" ON public.submission_people FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_id AND p.user_id = auth.uid()));
CREATE POLICY "organizers manage accommodations" ON public.accommodations FOR ALL TO authenticated
  USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "read own accommodation" ON public.accommodations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_id AND p.user_id = auth.uid()));
CREATE POLICY "organizers manage review" ON public.review_items FOR ALL TO authenticated
  USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "organizers read audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_organizer(auth.uid()));

-- Volunteer-safe directory (no phone, address, notes)
CREATE VIEW public.people_directory AS
  SELECT id, delegate_code, full_name, organization, category, (user_id IS NOT NULL) AS claimed, is_placeholder
  FROM public.people
  WHERE public.is_organizer(auth.uid()) OR public.has_role(auth.uid(), 'volunteer');
GRANT SELECT ON public.people_directory TO authenticated;

-- Audit trigger
CREATE OR REPLACE FUNCTION public.audit_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.audit_log(actor, table_name, row_id, action, diff)
  VALUES (auth.uid(), TG_TABLE_NAME,
    COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END), NULL),
    TG_OP,
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
         WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END);
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.audit_row() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER t_audit_people AFTER UPDATE OR DELETE ON public.people FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER t_audit_submissions AFTER UPDATE OR DELETE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER t_audit_subpeople AFTER INSERT OR DELETE ON public.submission_people FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER t_audit_accom AFTER INSERT OR UPDATE OR DELETE ON public.accommodations FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER t_audit_roles AFTER INSERT OR DELETE ON public.person_roles FOR EACH ROW EXECUTE FUNCTION public.audit_row();

-- Claim: attach signed-in account to their person record by email
CREATE OR REPLACE FUNCTION public.claim_my_person()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pid uuid; em text := lower(COALESCE(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL OR em = '' THEN RETURN NULL; END IF;
  SELECT id INTO pid FROM public.people WHERE user_id = auth.uid();
  IF pid IS NOT NULL THEN RETURN pid; END IF;
  UPDATE public.people SET user_id = auth.uid() WHERE email = em AND user_id IS NULL RETURNING id INTO pid;
  RETURN pid;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_my_person() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_my_person() TO authenticated;

-- Merge two people (organizers only)
CREATE OR REPLACE FUNCTION public.merge_people(_keep uuid, _drop uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _keep = _drop THEN RETURN; END IF;
  DELETE FROM public.submission_people d USING public.submission_people k
    WHERE d.person_id = _drop AND k.person_id = _keep AND k.submission_id = d.submission_id AND k.role = d.role;
  UPDATE public.submission_people SET person_id = _keep WHERE person_id = _drop;
  DELETE FROM public.person_roles d USING public.person_roles k
    WHERE d.person_id = _drop AND k.person_id = _keep AND k.role = d.role;
  UPDATE public.person_roles SET person_id = _keep WHERE person_id = _drop;
  UPDATE public.registrations SET person_id = _keep WHERE person_id = _drop;
  UPDATE public.accommodations SET person_id = _keep WHERE person_id = _drop;
  DELETE FROM public.people WHERE id = _drop;
END $$;

-- Roll back an import batch (removes its rows and anything it created that nothing else uses)
CREATE OR REPLACE FUNCTION public.rollback_import(_batch uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  DELETE FROM public.registrations WHERE batch_id = _batch;
  DELETE FROM public.review_items WHERE batch_id = _batch;
  DELETE FROM public.submissions s WHERE s.created_batch_id = _batch;
  DELETE FROM public.people p WHERE p.created_batch_id = _batch
    AND NOT EXISTS (SELECT 1 FROM public.registrations r WHERE r.person_id = p.id);
  UPDATE public.import_batches SET rolled_back_at = now() WHERE id = _batch;
END $$;

-- Placeholder test cohort: dummy people with invented papers, rooms and session links
CREATE OR REPLACE FUNCTION public.seed_placeholder_cohort(_batch text DEFAULT 'test-cohort-1')
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE
  names text[] := ARRAY['Test Aarav Menon','Test Ishita Rao','Test Kabir Sen','Test Meera Iyer','Test Rohan Das',
    'Test Ananya Bose','Test Vikram Nair','Test Priya Lyngdoh','Test Arjun Kharbuli','Test Sara Thomas',
    'Test Dev Kapoor','Test Nisha Pillai','Test Omar Qureshi','Test Leela Sangma','Test Farhan Ali'];
  orgs text[] := ARRAY['IIM Placeholder A','IIM Placeholder B','Placeholder University','Placeholder Business School'];
  tracks text[] := ARRAY['Strategy','Finance','Marketing','Operations','Sustainability'];
  topics text[] := ARRAY['platform ecosystems','ESG-linked debt','rural fintech adoption','supply-chain resilience',
    'family-firm succession','green bonds in emerging markets','gig-work wellbeing','AI in retail pricing'];
  residences text[] := ARRAY['Placeholder Hostel A','Placeholder Hostel B','Placeholder Guest House'];
  sess uuid[]; pid uuid; sid uuid; i int; n int := 0;
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT array_agg(id ORDER BY starts_at) INTO sess FROM public.sessions WHERE session_type = 'paper';
  IF sess IS NULL THEN SELECT array_agg(id ORDER BY starts_at) INTO sess FROM public.sessions; END IF;
  FOR i IN 1..array_length(names, 1) LOOP
    INSERT INTO public.people(email, full_name, phone, organization, category, is_placeholder, placeholder_batch)
    VALUES (format('test+%s@placeholder.paniim.test', lpad(i::text, 2, '0')), names[i], '+91 90000 000' || lpad(i::text, 2, '0'),
      orgs[1 + (i % 4)], CASE WHEN i % 3 = 0 THEN 'Research Scholars' ELSE 'Academics & Faculty' END, true, _batch)
    ON CONFLICT (email) DO NOTHING RETURNING id INTO pid;
    CONTINUE WHEN pid IS NULL;
    n := n + 1;
    INSERT INTO public.person_roles(person_id, role, is_placeholder, placeholder_batch)
      VALUES (pid, CASE WHEN i % 5 = 0 THEN 'track_chair' WHEN i % 4 = 0 THEN 'reviewer' ELSE 'presenter' END, true, _batch);
    INSERT INTO public.submissions(submission_code, title, abstract, track, session_id, is_placeholder, placeholder_batch)
      VALUES ('TEST-' || lpad(i::text, 3, '0'),
        initcap('rethinking ' || topics[1 + (i % 8)]) || ': evidence from India',
        'Placeholder abstract for testing. This study examines ' || topics[1 + (i % 8)] || ' using a mixed-methods design.',
        tracks[1 + (i % 5)],
        CASE WHEN sess IS NULL THEN NULL ELSE sess[1 + (i % array_length(sess, 1))] END, true, _batch)
      RETURNING id INTO sid;
    INSERT INTO public.submission_people(submission_id, person_id, role, is_placeholder, placeholder_batch)
      VALUES (sid, pid, 'presenter', true, _batch);
    INSERT INTO public.accommodations(person_id, residence, room_no, check_in, check_out, is_placeholder, placeholder_batch)
      VALUES (pid, residences[1 + (i % 3)], (100 + i)::text, '2026-12-09', '2026-12-13', true, _batch);
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.clear_placeholders()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  DELETE FROM public.submission_people WHERE is_placeholder;
  DELETE FROM public.accommodations WHERE is_placeholder;
  DELETE FROM public.person_roles WHERE is_placeholder;
  DELETE FROM public.registrations WHERE is_placeholder;
  DELETE FROM public.submissions WHERE is_placeholder;
  DELETE FROM public.people WHERE is_placeholder;
END $$;

REVOKE EXECUTE ON FUNCTION public.merge_people(uuid, uuid), public.rollback_import(uuid),
  public.seed_placeholder_cohort(text), public.clear_placeholders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid), public.rollback_import(uuid),
  public.seed_placeholder_cohort(text), public.clear_placeholders() TO authenticated;
