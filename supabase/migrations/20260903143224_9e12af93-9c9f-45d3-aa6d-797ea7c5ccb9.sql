CREATE TABLE public.mess_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  location_name text,
  highlight text NOT NULL,
  items text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  note text,
  status text NOT NULL DEFAULT 'scheduled',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mess_meals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mess_meals TO authenticated;
GRANT ALL ON public.mess_meals TO service_role;

ALTER TABLE public.mess_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read mess meals" ON public.mess_meals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write mess meals" ON public.mess_meals FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));

CREATE TRIGGER t_mess_meals_updated BEFORE UPDATE ON public.mess_meals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.campus_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  icon text NOT NULL DEFAULT 'sparkles',
  action_label text,
  action_url text,
  phone text,
  hours text,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  lat double precision,
  lng double precision,
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.campus_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campus_services TO authenticated;
GRANT ALL ON public.campus_services TO service_role;

ALTER TABLE public.campus_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read campus services" ON public.campus_services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "organizers write campus services" ON public.campus_services FOR ALL TO authenticated USING (public.is_organizer(auth.uid())) WITH CHECK (public.is_organizer(auth.uid()));

CREATE TRIGGER t_campus_services_updated BEFORE UPDATE ON public.campus_services FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.mess_meals (meal, starts_at, ends_at, location_name, highlight, items, tags, note, sort_order) VALUES
('Breakfast','2026-12-10T01:30:00Z','2026-12-10T03:30:00Z','Main Mess, Academic Block','Aloo paratha with white butter',ARRAY['Aloo paratha','Poha','Boiled eggs','Fresh fruit','Masala chai & filter coffee'],ARRAY['veg','egg'],NULL,1),
('Lunch','2026-12-10T07:00:00Z','2026-12-10T08:45:00Z','Main Mess, Academic Block','Jadoh with Khasi chicken curry',ARRAY['Jadoh','Khasi chicken curry','Dal tadka','Mixed veg','Curd','Gulab jamun'],ARRAY['veg','non-veg'],NULL,2),
('Snacks','2026-12-10T10:30:00Z','2026-12-10T11:30:00Z','Conference Foyer','Samosa & Meghalaya orange tea',ARRAY['Samosa','Veg sandwich','Cookies','Orange tea','Coffee'],ARRAY['veg'],'Served alongside the afternoon tea break.',3),
('Dinner','2026-12-10T14:00:00Z','2026-12-10T16:00:00Z','Main Mess, Academic Block','Smoked pork & rice (veg thali available)',ARRAY['Steamed rice','Smoked pork with bamboo shoot','Paneer butter masala','Dal','Roti','Ice cream'],ARRAY['veg','non-veg'],NULL,4),
('Breakfast','2026-12-11T01:30:00Z','2026-12-11T03:30:00Z','Main Mess, Academic Block','Idli sambar & coconut chutney',ARRAY['Idli','Sambar','Coconut chutney','Upma','Boiled eggs','Tea & coffee'],ARRAY['veg','egg'],NULL,5),
('Lunch','2026-12-11T07:00:00Z','2026-12-11T08:45:00Z','Main Mess, Academic Block','Rajma chawal',ARRAY['Rajma','Jeera rice','Roti','Bhindi masala','Salad','Kheer'],ARRAY['veg','jain'],NULL,6),
('Snacks','2026-12-11T10:30:00Z','2026-12-11T11:30:00Z','Conference Foyer','Pukhlein & tea',ARRAY['Pukhlein','Veg puff','Banana chips','Tea','Coffee'],ARRAY['veg'],NULL,7),
('Dinner','2026-12-11T14:00:00Z','2026-12-11T16:30:00Z','Amphitheatre Lawn','Gala dinner: Meghalayan grill counter',ARRAY['Live grill counter','Doh khleh salad','Tungrymbai','Paneer tikka','Biryani','Assorted desserts'],ARRAY['veg','non-veg'],'Conference gala dinner with cultural performances. Dress warm — it is outdoors.',8),
('Breakfast','2026-12-12T01:30:00Z','2026-12-12T03:30:00Z','Main Mess, Academic Block','Puri bhaji',ARRAY['Puri','Aloo bhaji','Cornflakes & milk','Fruit','Tea & coffee'],ARRAY['veg'],NULL,9),
('Lunch','2026-12-12T07:00:00Z','2026-12-12T08:45:00Z','Main Mess, Academic Block','Farewell thali',ARRAY['Veg pulao','Chicken curry','Dal fry','Roti','Papad','Rasgulla'],ARRAY['veg','non-veg'],'Packed lunch boxes available for delegates leaving early — ask at the help desk.',10),
('Snacks','2026-12-12T10:30:00Z','2026-12-12T11:15:00Z','Conference Foyer','Tea & cookies',ARRAY['Tea','Coffee','Cookies','Fruit'],ARRAY['veg'],NULL,11);

INSERT INTO public.campus_services (name, description, category, icon, action_label, action_url, phone, hours, featured, sort_order) VALUES
('Munchies','Campus café and late-night snack counter. Order ahead and pick up, or get it delivered to your hostel block.','food','utensils','Order food','https://munchies.planos.in',NULL,'8:00 am – 11:30 pm',true,1),
('Help desk','Registration, kits, lost & found, packed meals and anything else. Staffed through the conference.','help','life-buoy','Call help desk',NULL,'+91 98000 11122','7:00 am – 10:00 pm',true,2),
('Medical room','On-campus nurse with a doctor on call. Ambulance available for Shillong hospitals.','medical','stethoscope','Call medical',NULL,'+91 98000 11133','24 hours',true,3),
('Laundry','Same-day wash and fold, drop-off at the hostel service counter.','utility','shirt',NULL,NULL,NULL,'8:00 am – 6:00 pm',false,4),
('Gym & sports complex','Cardio, weights and an indoor court. Show your delegate badge at entry.','wellness','dumbbell',NULL,NULL,NULL,'5:30 am – 9:00 pm',false,5),
('ATM & bank counter','SBI ATM near the academic block entrance. Carry some cash — cards are patchy outside campus.','money','banknote',NULL,NULL,NULL,'24 hours',false,6),
('Printing & stationery','Print handouts, posters and slides. Send files ahead over WhatsApp.','utility','printer','WhatsApp files','https://wa.me/919800011144','+91 98000 11144','8:00 am – 8:00 pm',false,7),
('Shuttle desk','Campus shuttle to Police Bazar and airport transfer bookings.','transport','bus','Call shuttle desk',NULL,'+91 98000 11155','6:00 am – 9:00 pm',true,8),
('Wi-Fi help','Guest Wi-Fi credentials are printed on your badge. Trouble connecting? The IT desk is in the academic block lobby.','utility','wifi',NULL,NULL,NULL,'8:00 am – 8:00 pm',false,9);