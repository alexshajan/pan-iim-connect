CREATE TABLE public.calendar_feeds (
  user_id uuid PRIMARY KEY,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(18), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.calendar_feeds TO authenticated;
GRANT ALL ON public.calendar_feeds TO service_role;
ALTER TABLE public.calendar_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feed read" ON public.calendar_feeds FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own feed create" ON public.calendar_feeds FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own feed reset" ON public.calendar_feeds FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.notification_prefs (
  user_id uuid PRIMARY KEY,
  push_enabled boolean NOT NULL DEFAULT false,
  schedule_changes boolean NOT NULL DEFAULT true,
  session_reminders boolean NOT NULL DEFAULT true,
  general_updates boolean NOT NULL DEFAULT true,
  email_updates boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs read" ON public.notification_prefs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own prefs insert" ON public.notification_prefs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prefs update" ON public.notification_prefs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "organizers read prefs" ON public.notification_prefs FOR SELECT TO authenticated USING (public.is_organizer(auth.uid()));