CREATE TABLE public.sync_sessions (code text primary key, s timestamptz, e timestamptz, mode text, slot text, pt text, room text, area text, title text, chair text, co text);
CREATE TABLE public.sync_papers (code text primary key, sess text, ord int, mode text);
GRANT ALL ON public.sync_sessions TO service_role;
GRANT ALL ON public.sync_papers TO service_role;
ALTER TABLE public.sync_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_papers ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.sync_sessions IS 'Staging for organizer workbook sync; no client access.';
COMMENT ON TABLE public.sync_papers IS 'Staging for organizer workbook sync; no client access.';