
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','editor','volunteer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  affiliation text,
  headline text,
  linkedin_url text,
  networking_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_organizer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','editor'))
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PUBLIC CONTENT
CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  kind text NOT NULL DEFAULT 'session',
  description text,
  lat double precision,
  lng double precision,
  walk_minutes int,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  accent text NOT NULL DEFAULT 'primary',
  description text,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text,
  session_type text NOT NULL DEFAULT 'paper',
  track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  chair text,
  capacity int,
  status text NOT NULL DEFAULT 'scheduled',
  status_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  abstract text,
  authors text NOT NULL,
  affiliation text,
  presenter_email text,
  discussant text,
  slot_order int NOT NULL DEFAULT 0
);

CREATE TABLE public.map_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  description text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE public.content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  subtitle text,
  body text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  urgent boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  affiliation text,
  role text NOT NULL DEFAULT 'delegate',
  residence text,
  room_no text,
  arrival_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  rating int,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text,
  contact text,
  category text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- GRANTS
GRANT SELECT ON public.venues, public.tracks, public.sessions, public.papers, public.map_pins, public.content_blocks, public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venues, public.tracks, public.sessions, public.papers, public.map_pins, public.content_blocks, public.announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants, public.bookmarks, public.feedback, public.help_requests TO authenticated;
GRANT INSERT ON public.help_requests TO anon;
GRANT ALL ON public.venues, public.tracks, public.sessions, public.papers, public.map_pins, public.content_blocks, public.announcements, public.participants, public.bookmarks, public.feedback, public.help_requests TO service_role;

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read venues" ON public.venues FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write venues" ON public.venues FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "public read tracks" ON public.tracks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write tracks" ON public.tracks FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "public read sessions" ON public.sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write sessions" ON public.sessions FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "public read papers" ON public.papers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write papers" ON public.papers FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "public read pins" ON public.map_pins FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write pins" ON public.map_pins FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "public read content" ON public.content_blocks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write content" ON public.content_blocks FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));
CREATE POLICY "public read announcements" ON public.announcements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write announcements" ON public.announcements FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));

CREATE POLICY "own participant row" ON public.participants FOR SELECT TO authenticated USING (lower(email) = lower(coalesce(auth.jwt()->>'email','')) OR public.is_organizer(auth.uid()));
CREATE POLICY "organizers write participants" ON public.participants FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));

CREATE POLICY "own bookmarks" ON public.bookmarks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own feedback" ON public.feedback FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_organizer(auth.uid())) WITH CHECK (user_id = auth.uid());

CREATE POLICY "submit help" ON public.help_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "read own help" ON public.help_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_organizer(auth.uid()));
CREATE POLICY "organizers manage help" ON public.help_requests FOR UPDATE TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));

CREATE TRIGGER t_sessions_updated BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_content_updated BEFORE UPDATE ON public.content_blocks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_venues_updated BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- SEED
INSERT INTO public.venues (id, name, short_name, kind, description, lat, lng, walk_minutes, sort_order) VALUES
('11111111-0000-0000-0000-000000000001','Main Auditorium, Academic Block','Auditorium','session','Plenary hall, seats 600. Ground floor, Academic Block A.',25.6751,91.9155,0,1),
('11111111-0000-0000-0000-000000000002','Seminar Hall 1','SH-1','session','Parallel track room, seats 90. First floor.',25.6753,91.9157,3,2),
('11111111-0000-0000-0000-000000000003','Seminar Hall 2','SH-2','session','Parallel track room, seats 90. First floor.',25.6754,91.9158,3,3),
('11111111-0000-0000-0000-000000000004','Classroom C-201','C-201','session','Parallel track room, seats 60.',25.6749,91.9161,5,4),
('11111111-0000-0000-0000-000000000005','Classroom C-202','C-202','session','Parallel track room, seats 60.',25.6748,91.9162,5,5),
('11111111-0000-0000-0000-000000000006','Central Lawn','Lawn','dining','Tea, lunch and open networking.',25.6746,91.9153,4,6),
('11111111-0000-0000-0000-000000000007','Hotel Polo Towers, Shillong','Polo Towers','offsite','Conference banquet and cultural evening. 14 km from campus.',25.5697,91.8836,0,7);

INSERT INTO public.tracks (id, name, accent, description, sort_order) VALUES
('22222222-0000-0000-0000-000000000001','Strategy & Entrepreneurship','indigo','Firm strategy, new ventures, family business.',1),
('22222222-0000-0000-0000-000000000002','Sustainability & Development','moss','Climate, ESG, inclusive growth in the North East.',2),
('22222222-0000-0000-0000-000000000003','Digital & Analytics','sky','AI, platforms, data-driven decision making.',3),
('22222222-0000-0000-0000-000000000004','Finance & Accounting','sand','Capital markets, banking, corporate finance.',4),
('22222222-0000-0000-0000-000000000005','OB, HR & Behaviour','clay','Work, teams, leadership and behavioural science.',5);

INSERT INTO public.sessions (id, title, summary, session_type, track_id, venue_id, starts_at, ends_at, chair, capacity, status, status_note) VALUES
('33333333-0000-0000-0000-000000000001','Inaugural Session & Lighting of the Lamp','Welcome address by the Director, IIM Shillong, followed by the conference theme address.','plenary',NULL,'11111111-0000-0000-0000-000000000001','2026-12-10 03:30:00+00','2026-12-10 05:00:00+00','Director, IIM Shillong',600,'scheduled',NULL),
('33333333-0000-0000-0000-000000000002','Keynote: Management Research from the Margins','Why the next decade of Indian management scholarship will be written outside the metros.','keynote',NULL,'11111111-0000-0000-0000-000000000001','2026-12-10 05:15:00+00','2026-12-10 06:15:00+00','Prof. A. Bhattacharya',600,'scheduled',NULL),
('33333333-0000-0000-0000-000000000003','Lunch & Networking','Buffet lunch on the Central Lawn. Vegetarian, non-vegetarian and Jain counters.','break',NULL,'11111111-0000-0000-0000-000000000006','2026-12-10 06:30:00+00','2026-12-10 08:00:00+00',NULL,NULL,'scheduled',NULL),
('33333333-0000-0000-0000-000000000004','Paper Session 1A: Venture Formation in Emerging Markets','Four papers on early-stage venture strategy.','paper','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002','2026-12-10 08:00:00+00','2026-12-10 09:30:00+00','Prof. R. Menon',90,'scheduled',NULL),
('33333333-0000-0000-0000-000000000005','Paper Session 1B: Climate Adaptation & Livelihoods','Field research from the Eastern Himalaya.','paper','22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000003','2026-12-10 08:00:00+00','2026-12-10 09:30:00+00','Prof. S. Lyngdoh',90,'moved','Moved from C-201 to Seminar Hall 2'),
('33333333-0000-0000-0000-000000000006','Paper Session 1C: Algorithmic Decision Making','Three papers plus a discussant panel.','paper','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004','2026-12-10 08:00:00+00','2026-12-10 09:30:00+00','Prof. K. Iyer',60,'scheduled',NULL),
('33333333-0000-0000-0000-000000000007','Panel: Funding Research in Indian B-Schools','Editors and funders in conversation.','panel',NULL,'11111111-0000-0000-0000-000000000001','2026-12-10 09:45:00+00','2026-12-10 11:00:00+00','Prof. M. Das',600,'scheduled',NULL),
('33333333-0000-0000-0000-000000000008','Paper Session 2A: Corporate Finance in Volatile Markets','Four empirical papers.','paper','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000002','2026-12-11 03:30:00+00','2026-12-11 05:00:00+00','Prof. V. Rao',90,'scheduled',NULL),
('33333333-0000-0000-0000-000000000009','Paper Session 2B: Teams, Trust and Hybrid Work','Behavioural studies across Indian firms.','paper','22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000003','2026-12-11 03:30:00+00','2026-12-11 05:00:00+00','Prof. N. Sharma',90,'scheduled',NULL),
('33333333-0000-0000-0000-00000000000a','Doctoral Colloquium','Closed-door feedback for doctoral scholars. Registration required.','workshop',NULL,'11111111-0000-0000-0000-000000000005','2026-12-11 05:15:00+00','2026-12-11 07:00:00+00','Prof. P. Chandra',60,'scheduled',NULL),
('33333333-0000-0000-0000-00000000000b','Conference Banquet & Cultural Evening','Khasi cultural performance followed by dinner. Buses leave campus at 5:30 PM sharp.','social',NULL,'11111111-0000-0000-0000-000000000007','2026-12-11 12:30:00+00','2026-12-11 16:00:00+00',NULL,NULL,'scheduled',NULL),
('33333333-0000-0000-0000-00000000000c','Paper Session 3A: Platforms and the Informal Economy','Four papers on gig work and digital platforms.','paper','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000002','2026-12-12 03:30:00+00','2026-12-12 05:00:00+00','Prof. D. Ghosh',90,'delayed','Starting 15 minutes late'),
('33333333-0000-0000-0000-00000000000d','Valedictory Session & Best Paper Awards','Closing remarks, awards and handover to the next host institute.','plenary',NULL,'11111111-0000-0000-0000-000000000001','2026-12-12 06:00:00+00','2026-12-12 07:30:00+00','Conference Chair',600,'scheduled',NULL);

INSERT INTO public.papers (session_id, title, abstract, authors, affiliation, discussant, slot_order) VALUES
('33333333-0000-0000-0000-000000000004','Bricolage and Survival: How Tier-3 Ventures Bootstrap','A multi-case study of 24 ventures across Assam and Meghalaya examining resource bricolage under institutional voids.','Ananya Deka, Rohit Verma','IIM Shillong','Prof. R. Menon',1),
('33333333-0000-0000-0000-000000000004','Family Firm Succession and Risk Appetite','Panel evidence from 380 listed family firms on how succession events shift investment risk.','Kartik Shah','IIM Ahmedabad','Prof. R. Menon',2),
('33333333-0000-0000-0000-000000000004','Incubator Selection and Venture Survival','Does incubator selection add value, or merely pick winners? Evidence from 12 Indian incubators.','Meera Nair, S. Balasubramanian','IIM Kozhikode','Prof. R. Menon',3),
('33333333-0000-0000-0000-000000000005','Terrace Farming under Erratic Monsoons','Household-level adaptation strategies in the Khasi Hills, 2018-2025.','Banri Kharkongor','NEHU','Prof. S. Lyngdoh',1),
('33333333-0000-0000-0000-000000000005','ESG Disclosure Quality in Indian Mid-Caps','Text-analytic evidence on greenwashing in BRSR filings.','Ishaan Roy, Priya Menon','IIM Bangalore','Prof. S. Lyngdoh',2),
('33333333-0000-0000-0000-000000000006','Algorithmic Aversion in Credit Officers','A field experiment with 210 loan officers on when humans override models.','Tanvi Kulkarni','IIM Calcutta','Prof. K. Iyer',1),
('33333333-0000-0000-0000-000000000006','LLMs in Management Classrooms','A quasi-experiment on learning outcomes across two MBA cohorts.','Arjun Pillai, Nabanita Sen','IIM Indore','Prof. K. Iyer',2),
('33333333-0000-0000-0000-000000000008','Currency Volatility and Export Hedging','Firm-level evidence from Indian exporters, 2010-2024.','Sanjay Iyer','IIM Lucknow','Prof. V. Rao',1),
('33333333-0000-0000-0000-000000000009','Trust Repair in Distributed Teams','A longitudinal study of 40 hybrid teams.','Riya Chatterjee','XLRI','Prof. N. Sharma',1),
('33333333-0000-0000-0000-00000000000c','Rating Systems and Gig Worker Autonomy','Interviews with 96 platform workers in Guwahati and Shillong.','Wanshan Marbaniang, Deep Saikia','IIM Shillong','Prof. D. Ghosh',1);

INSERT INTO public.map_pins (name, category, description, lat, lng, sort_order) VALUES
('Academic Block A','venue','Auditorium, seminar halls and registration desk.',25.6751,91.9155,1),
('Registration & Help Desk','help','Open 7:30 AM - 7:00 PM daily. Badges, kits, queries.',25.6752,91.9154,2),
('Central Lawn','dining','Tea, lunch and networking.',25.6746,91.9153,3),
('Mess & Cafeteria','dining','Breakfast 7-9:30 AM, dinner 7:30-9:30 PM.',25.6742,91.9149,4),
('Nongthymmai Guest House','residence','Faculty and invited-speaker accommodation.',25.6739,91.9147,5),
('Hostel Block 1','residence','Delegate accommodation, rooms 101-260.',25.6736,91.9144,6),
('Hostel Block 2','residence','Delegate accommodation, rooms 301-460.',25.6735,91.9141,7),
('Medical Room','medical','Nurse on duty 24x7 during the conference. Ambulance on call.',25.6744,91.9151,8),
('Shuttle Pickup Point','transport','Campus shuttles to Police Bazar and banquet venue.',25.6755,91.9150,9),
('Visitor Parking','parking','Free parking for delegates with a conference pass.',25.6757,91.9148,10);

INSERT INTO public.content_blocks (category, title, subtitle, body, meta, sort_order) VALUES
('travel','Fly to Guwahati (GAU), then road to Shillong','Most reliable option','Lokpriya Gopinath Bordoloi International Airport at Guwahati is the main gateway, ~125 km from Shillong. Prepaid taxis and shared sumos run from the airport to Shillong from early morning until about 6 PM. Book ahead in December.','{"duration":"3.5 - 4 hrs by road","price":"₹450 shared cab · ₹3,200-4,000 private taxi","tag":"Recommended"}',1),
('travel','Fly direct to Shillong (SHL, Umroi)','Fastest, limited flights','Umroi Airport is 30 km from Shillong city and about 20 km from the IIM Shillong campus. Only a handful of ATR flights operate daily, usually via Kolkata or Guwahati. Taxis at Umroi are limited — pre-book.','{"duration":"45 min to campus","price":"₹1,200-1,800 taxi","tag":"Book early"}',2),
('travel','Helicopter, Guwahati to Shillong','Weather dependent','Pawan Hans operates a short helicopter service between Guwahati and Shillong most weekday mornings. Frequently cancelled in poor visibility — always keep a road backup.','{"duration":"25 min","price":"₹3,000-3,500","tag":"Weather risk"}',3),
('travel','Train to Guwahati (GHY), then road','Budget friendly','Guwahati is the nearest railhead. Take a train to GHY, then a shared sumo from Paltan Bazar to Shillong. Sumos leave when full, roughly every 30 minutes until evening.','{"duration":"3.5 hrs from GHY","price":"₹400-500 shared sumo","tag":"Budget"}',4),
('travel','Shillong city to IIM Shillong campus','Last leg','The campus is at Umsawli, about 40 minutes from Police Bazar. Local taxis, app cabs and conference shuttles all serve the route. Conference shuttles run on a published timetable during the three days.','{"duration":"35-45 min","price":"₹500-700 taxi · free shuttle","tag":"Shuttle available"}',5),
('campus','Mess & Cafeteria','Academic Block, ground floor','Breakfast 7:00-9:30 AM, lunch 12:30-2:00 PM, dinner 7:30-9:30 PM. Vegetarian, non-vegetarian and Jain options at every meal.','{"hours":"7 AM - 9:30 PM"}',1),
('campus','Tea Counters','Central Lawn & first-floor lobby','Kong-style red tea and coffee between all sessions. Local snacks in the afternoon break.','{"hours":"During breaks"}',2),
('campus','ATM & Cash','Near the main gate','One SBI ATM on campus. Cash is useful for local taxis and markets — many small vendors in Shillong prefer UPI or cash over cards.','{"hours":"24x7"}',3),
('campus','Wi-Fi','Network: PANIIM-2026','Connect to PANIIM-2026 and sign in with your registered email. Support at the registration desk if the captive portal does not load.','{"hours":"Always on"}',4),
('campus','Medical & Emergency','Medical room, near Hostel Block 1','A nurse is on duty round the clock during the conference, with a doctor on call and an ambulance stationed on campus. Carry any personal medication — pharmacies are 20 minutes away.','{"hours":"24x7"}',5),
('campus','Printing & Stationery','Registration desk','Last-minute poster and handout printing available until 6 PM. Charged at cost.','{"hours":"8 AM - 6 PM"}',6),
('city','Elephant Falls & Shillong Peak','Half day, 1 hr from campus','A classic three-tier waterfall followed by the highest viewpoint over Shillong. Best in the morning before the cloud settles in. Carry ID for the Shillong Peak checkpoint.','{"duration":"Half day","tag":"Easy"}',1),
('city','Cherrapunjee (Sohra)','Full day, 2 hrs from Shillong','Nohkalikai Falls, Mawsmai caves and the Seven Sisters viewpoint. December is dry and clear — the best month of the year for this drive.','{"duration":"Full day","tag":"Must do"}',2),
('city','Living Root Bridges, Nongriat','Full day, strenuous','About 3,000 steps down and back up from Tyrna. Start by 7 AM. Not advisable if you have knee trouble.','{"duration":"Full day","tag":"Strenuous"}',3),
('city','Dawki & Mawlynnong','Full day, 2.5 hrs','The famously clear Umngot river at Dawki and Asia''s cleanest village at Mawlynnong. Carry your ID — you are near the Bangladesh border.','{"duration":"Full day","tag":"Popular"}',4),
('city','Police Bazar & Laitumkhrah','Evening','Shillong''s shopping and food core. Try jadoh, dohneiiong and a cafe stop on Laitumkhrah. Most shops close by 8 PM.','{"duration":"Evening","tag":"Food"}',5),
('city','What to pack for December','Weather note','Shillong in December runs 4-18°C. Mornings and evenings are genuinely cold. Bring layers, a windproof jacket, and comfortable walking shoes — the campus is spread out and hilly.','{"tag":"Practical"}',6),
('contact','Registration & Badges','Conference Secretariat','Lost badge, kit collection, certificate queries.','{"phone":"+91 98630 00001","whatsapp":"+919863000001","hours":"7:30 AM - 7 PM"}',1),
('contact','Accommodation','Hospitality Desk','Room allocation, check-in and check-out, housekeeping.','{"phone":"+91 98630 00002","whatsapp":"+919863000002","hours":"24x7"}',2),
('contact','AV & Technical Support','Session Support','Projector, mic, slide upload and presentation issues.','{"phone":"+91 98630 00003","hours":"7:30 AM - 8 PM"}',3),
('contact','Transport & Shuttles','Travel Desk','Airport pickups, shuttle timings, banquet buses, local taxis.','{"phone":"+91 98630 00004","whatsapp":"+919863000004","hours":"6 AM - 10 PM"}',4),
('contact','Medical Emergency','Campus Medical Room','Nurse on duty, doctor on call, ambulance on campus.','{"phone":"+91 98630 00005","hours":"24x7"}',5),
('contact','Security','Main Gate','Campus access, lost and found, after-hours assistance.','{"phone":"+91 98630 00006","hours":"24x7"}',6),
('faq','What should I carry to the venue each day?','','Your conference badge is required to enter session halls and for meals. Carry a light jacket — the halls are air-conditioned and Shillong mornings are cold.','{}',1),
('faq','How do I upload my presentation?','','Email your slides to av@paniim2026.in at least 12 hours before your session, or bring them on a USB drive to the AV desk 30 minutes before your slot.','{}',2),
('faq','Are meals included?','','Breakfast, lunch, tea and dinner are included for all registered delegates on all three days, plus the banquet on Day 2.','{}',3),
('faq','Can I bring an accompanying person?','','Yes, with prior registration. Accompanying persons can join meals and the cultural evening but not paper sessions.','{}',4),
('faq','Is there a certificate of presentation?','','Certificates are issued at the registration desk from the afternoon of Day 3, after your session chair confirms your presentation.','{}',5),
('faq','What if my session timing changes?','','Any change is pushed to the app immediately and flagged on the schedule. Signed-in delegates whose starred sessions change also get a notification.','{}',6);

INSERT INTO public.announcements (title, body, audience, urgent, published_at) VALUES
('Shuttle timings published','Campus shuttles to Police Bazar run every 45 minutes from 8 AM to 9 PM from the Shuttle Pickup Point.','all',false,now() - interval '2 hours'),
('Session 1B moved to Seminar Hall 2','Climate Adaptation & Livelihoods has shifted from C-201 to Seminar Hall 2 for better capacity.','all',true,now() - interval '30 minutes'),
('Slide upload deadline','Presenters, please email slides to av@paniim2026.in at least 12 hours before your session.','presenters',false,now() - interval '1 day');

INSERT INTO public.participants (email, full_name, affiliation, role, residence, room_no, arrival_note) VALUES
('demo.delegate@paniim2026.in','Demo Delegate','IIM Shillong','presenter','Hostel Block 1','214','Arriving Dec 9, evening. Airport pickup booked from Guwahati.'),
('organizer@paniim2026.in','Conference Secretariat','IIM Shillong','organizer','Nongthymmai Guest House','G-04',NULL);
