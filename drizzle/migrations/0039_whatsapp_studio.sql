CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL UNIQUE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  attempts integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organizers read wa events" ON public.whatsapp_webhook_events FOR SELECT TO authenticated USING (public.is_organizer(auth.uid()));
CREATE INDEX whatsapp_webhook_events_pending ON public.whatsapp_webhook_events (received_at) WHERE processed_at IS NULL;

CREATE TABLE public.whatsapp_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  params jsonb NOT NULL DEFAULT '[]'::jsonb,
  total integer NOT NULL DEFAULT 0,
  accepted integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_broadcasts TO authenticated;
GRANT ALL ON public.whatsapp_broadcasts TO service_role;
ALTER TABLE public.whatsapp_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organizers read broadcasts" ON public.whatsapp_broadcasts FOR SELECT TO authenticated USING (public.is_organizer(auth.uid()));

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid text UNIQUE,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  wa_id text NOT NULL,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'text',
  body text,
  template_name text,
  media_id text,
  status text NOT NULL DEFAULT 'accepted',
  error jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  broadcast_id uuid REFERENCES public.whatsapp_broadcasts(id) ON DELETE SET NULL,
  sent_by uuid,
  provider_ts timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organizers read wa messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (public.is_organizer(auth.uid()));
CREATE INDEX whatsapp_messages_thread ON public.whatsapp_messages (wa_id, created_at DESC);
CREATE INDEX whatsapp_messages_broadcast ON public.whatsapp_messages (broadcast_id);