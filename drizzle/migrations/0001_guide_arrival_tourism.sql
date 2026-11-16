
CREATE TABLE public.travel_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('main','last_mile')),
  from_place text NOT NULL,
  to_place text NOT NULL,
  mode text NOT NULL,
  fare_min integer NOT NULL,
  fare_max integer NOT NULL,
  duration_min integer NOT NULL,
  frequency text,
  notes text,
  last_verified date,
  sort_order integer NOT NULL DEFAULT 0,
  is_placeholder boolean NOT NULL DEFAULT false,
  placeholder_batch text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.travel_legs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_legs TO authenticated;
GRANT ALL ON public.travel_legs TO service_role;
ALTER TABLE public.travel_legs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read legs" ON public.travel_legs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write legs" ON public.travel_legs FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));

CREATE TABLE public.tourism_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area text NOT NULL CHECK (area IN ('shillong','beyond')),
  region text,
  summary text,
  tags text[] NOT NULL DEFAULT '{}',
  effort text NOT NULL DEFAULT 'easy' CHECK (effort IN ('easy','moderate','hard')),
  drive_min integer NOT NULL DEFAULT 0,
  visit_min integer NOT NULL DEFAULT 60,
  opens text NOT NULL DEFAULT '08:00',
  closes text NOT NULL DEFAULT '17:00',
  entry_fee integer NOT NULL DEFAULT 0,
  notes text,
  no_atm boolean NOT NULL DEFAULT false,
  low_signal boolean NOT NULL DEFAULT false,
  step_free boolean NOT NULL DEFAULT false,
  closed boolean NOT NULL DEFAULT false,
  lat double precision,
  lng double precision,
  last_verified date,
  sort_order integer NOT NULL DEFAULT 0,
  is_placeholder boolean NOT NULL DEFAULT false,
  placeholder_batch text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tourism_places TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tourism_places TO authenticated;
GRANT ALL ON public.tourism_places TO service_role;
ALTER TABLE public.tourism_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read places" ON public.tourism_places FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write places" ON public.tourism_places FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));

CREATE TABLE public.cab_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  whatsapp text,
  vehicle text,
  seats integer NOT NULL DEFAULT 4,
  languages text[] NOT NULL DEFAULT '{}',
  routes jsonb NOT NULL DEFAULT '[]',
  notes text,
  active boolean NOT NULL DEFAULT true,
  is_placeholder boolean NOT NULL DEFAULT false,
  placeholder_batch text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cab_drivers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cab_drivers TO authenticated;
GRANT ALL ON public.cab_drivers TO service_role;
ALTER TABLE public.cab_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active cabs" ON public.cab_drivers FOR SELECT TO anon, authenticated USING (active OR public.is_organizer(auth.uid()));
CREATE POLICY "organizers write cabs" ON public.cab_drivers FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));

CREATE TABLE public.guide_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  module text NOT NULL DEFAULT 'any' CHECK (module IN ('arrival','tourism','any')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.guide_prompts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_prompts TO authenticated;
GRANT ALL ON public.guide_prompts TO service_role;
ALTER TABLE public.guide_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read prompts" ON public.guide_prompts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write prompts" ON public.guide_prompts FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));

CREATE TABLE public.guide_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_threads TO authenticated;
GRANT ALL ON public.guide_threads TO service_role;
ALTER TABLE public.guide_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads" ON public.guide_threads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.guide_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.guide_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message_id text NOT NULL,
  message jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_messages TO authenticated;
GRANT ALL ON public.guide_messages TO service_role;
ALTER TABLE public.guide_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.guide_messages FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.guide_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.clear_guide_placeholders() RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'organizers only'; END IF;
  DELETE FROM public.travel_legs WHERE is_placeholder;
  DELETE FROM public.tourism_places WHERE is_placeholder;
  DELETE FROM public.cab_drivers WHERE is_placeholder;
END $$;

-- Sample data (indicative, flagged placeholder until organizer data arrives)
INSERT INTO public.travel_legs (kind, from_place, to_place, mode, fare_min, fare_max, duration_min, frequency, notes, last_verified, sort_order, is_placeholder, placeholder_batch) VALUES
('main','Delhi','Guwahati','air',4500,9500,150,'10+ daily','Book 3+ weeks ahead for late November.','2026-10-01',1,true,'guide-sample'),
('main','Delhi','Guwahati','train',1800,4800,1680,'Daily (Rajdhani)','3AC to 2AC fare range.','2026-10-01',2,true,'guide-sample'),
('main','Mumbai','Guwahati','air',5500,11000,210,'6+ daily',NULL,'2026-10-01',3,true,'guide-sample'),
('main','Kolkata','Guwahati','air',3200,7000,75,'12+ daily',NULL,'2026-10-01',4,true,'guide-sample'),
('main','Kolkata','Guwahati','train',900,2600,1050,'Daily (Saraighat Exp)',NULL,'2026-10-01',5,true,'guide-sample'),
('main','Kolkata','Shillong (Umroi)','air',3500,8000,80,'Few weekly','Small airport, flights can cancel in fog.','2026-10-01',6,true,'guide-sample'),
('main','Bengaluru','Guwahati','air',5500,11500,195,'6+ daily',NULL,'2026-10-01',7,true,'guide-sample'),
('main','Chennai','Guwahati','air',5500,11000,180,'4+ daily',NULL,'2026-10-01',8,true,'guide-sample'),
('main','Hyderabad','Guwahati','air',5000,10500,165,'4+ daily',NULL,'2026-10-01',9,true,'guide-sample'),
('main','Pune','Guwahati','air',6000,12000,240,'Few daily, often 1 stop',NULL,'2026-10-01',10,true,'guide-sample'),
('last_mile','Guwahati Airport','Shillong','cab',2800,3800,180,'On demand','Prepaid taxi counter at arrivals. Avoid driving after dark.','2026-10-01',20,true,'guide-sample'),
('last_mile','Guwahati Airport','Shillong','shared_taxi',500,700,210,'Fills and leaves','Shared Sumo per seat from airport stand.','2026-10-01',21,true,'guide-sample'),
('last_mile','Guwahati Airport','Shillong','helicopter',3500,4500,30,'Weekdays, weather-dependent','Pawan Hans, limited seats and baggage.','2026-10-01',22,true,'guide-sample'),
('last_mile','Guwahati Railway Station','Shillong','cab',2400,3200,165,'On demand',NULL,'2026-10-01',23,true,'guide-sample'),
('last_mile','Guwahati Railway Station','Shillong','bus',250,450,240,'Hourly, 6am–4pm','MTC / private buses from Paltan Bazaar.','2026-10-01',24,true,'guide-sample'),
('last_mile','Shillong','IIM Shillong campus','cab',400,700,35,'On demand','Police Bazar to Umsawli campus.','2026-10-01',30,true,'guide-sample'),
('last_mile','Shillong (Umroi)','IIM Shillong campus','cab',1200,1800,60,'On demand','Umroi airport to campus.','2026-10-01',31,true,'guide-sample');

INSERT INTO public.tourism_places (name, area, region, summary, tags, effort, drive_min, visit_min, opens, closes, entry_fee, notes, no_atm, low_signal, step_free, lat, lng, last_verified, sort_order, is_placeholder, placeholder_batch) VALUES
('Police Bazar & Khyndailad','shillong','Central Shillong','The heart of Shillong for shopping and street food.','{shopping,food,culture}','easy',35,90,'10:00','20:00',0,NULL,false,false,true,25.5747,91.8826,'2026-10-01',1,true,'guide-sample'),
('Don Bosco Museum','shillong','Mawlai','Seven floors on the cultures of the Northeast, with a rooftop skywalk.','{culture}','easy',40,90,'09:30','16:30',200,'Closed Sundays.',false,false,true,25.5937,91.8964,'2026-10-01',2,true,'guide-sample'),
('Ward''s Lake','shillong','Central Shillong','A calm lake walk with boating, close to the city centre.','{nature}','easy',35,45,'08:30','17:00',30,NULL,false,false,true,25.5784,91.8885,'2026-10-01',3,true,'guide-sample'),
('Shillong Peak','shillong','Upper Shillong','Highest viewpoint over the city, inside an Air Force area.','{nature}','easy',45,45,'09:00','16:00',50,'Carry photo ID.',false,false,true,25.5487,91.8749,'2026-10-01',4,true,'guide-sample'),
('Elephant Falls','shillong','Upper Shillong','Three-tier waterfall reached by steps.','{nature}','moderate',45,60,'08:00','17:00',50,'Many steps, slippery when wet.',false,false,false,25.5384,91.8236,'2026-10-01',5,true,'guide-sample'),
('Laitlum Canyons','beyond','East Khasi Hills','Huge open canyon views; optional steep trek down to Rasong village.','{nature,adventure}','moderate',75,120,'07:00','16:30',20,'Trek down is hard; views are easy.',true,true,false,25.4660,91.9300,'2026-10-01',6,true,'guide-sample'),
('Sohra (Cherrapunjee) viewpoints','beyond','Sohra','Nohkalikai and Seven Sisters falls, Mawsmai cave.','{nature}','easy',110,240,'08:00','16:30',150,'Fog after 2pm in winter; start early.',false,true,false,25.2770,91.7300,'2026-10-01',7,true,'guide-sample'),
('Double Decker Root Bridge','beyond','Nongriat','Famous living root bridge, about 3,500 steps each way.','{nature,adventure}','hard',130,300,'07:00','15:00',100,'Start the descent before 9am.',true,true,false,25.2500,91.6800,'2026-10-01',8,true,'guide-sample'),
('Dawki & Shnongpdeng','beyond','West Jaintia Hills','Glass-clear Umngot river, boating and kayaking at the border.','{nature,adventure}','easy',160,180,'08:00','16:00',800,'Boat fee per boat; carry cash.',true,true,false,25.1880,92.0200,'2026-10-01',9,true,'guide-sample'),
('Mawlynnong village','beyond','East Khasi Hills','Known as one of the cleanest villages in Asia, with a sky view tower.','{culture,nature}','easy',150,120,'08:00','17:00',50,NULL,true,true,false,25.2018,91.9160,'2026-10-01',10,true,'guide-sample'),
('Umiam Lake','beyond','Ri-Bhoi','Big reservoir lake on the way to Guwahati, kayaking and cafés.','{nature,food,adventure}','easy',30,120,'09:00','17:00',50,NULL,false,false,true,25.6700,91.9000,'2026-10-01',11,true,'guide-sample'),
('Mawphlang Sacred Forest','beyond','East Khasi Hills','Guided walk through an ancient protected forest.','{nature,culture}','moderate',70,120,'09:00','16:00',100,'Guide included in fee.',true,true,false,25.4500,91.7500,'2026-10-01',12,true,'guide-sample');

INSERT INTO public.cab_drivers (name, phone, whatsapp, vehicle, seats, languages, routes, notes, is_placeholder, placeholder_batch) VALUES
('Sample driver — Kong Ibanri','+91 90000 00001','+91 90000 00001','Innova',6,'{English,Hindi,Khasi}','[{"route":"Guwahati Airport → Campus","fare":3800},{"route":"Day trip Sohra","fare":3500}]','Sample entry, not a real contact.',true,'guide-sample'),
('Sample driver — Bah Wanbok','+91 90000 00002','+91 90000 00002','Swift Dzire',4,'{English,Hindi}','[{"route":"Shillong → Campus","fare":600},{"route":"Day trip Dawki","fare":4500}]','Sample entry, not a real contact.',true,'guide-sample'),
('Sample driver — Rajesh','+91 90000 00003',NULL,'Tata Sumo',8,'{Hindi,Assamese,English}','[{"route":"Guwahati Station → Shillong","fare":3200}]','Sample entry, not a real contact.',true,'guide-sample');

INSERT INTO public.guide_prompts (text, module, sort_order) VALUES
('Cheapest way from Delhi to campus on 26 Nov?','arrival',1),
('I land in Guwahati at 4pm — can I still reach Shillong safely?','arrival',2),
('Shared cab or private cab from Guwahati airport?','arrival',3),
('Plan a half-day in Shillong for 3 of us after 2pm','tourism',4),
('Easy day trip to waterfalls on 30 Nov, budget ₹2,000 each','tourism',5),
('Is the Double Decker root bridge doable in one day?','tourism',6),
('What should I pack for Shillong in late November?','any',7);
