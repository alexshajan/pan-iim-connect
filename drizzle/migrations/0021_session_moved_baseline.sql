ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS base_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS base_venue_id uuid,
  ADD COLUMN IF NOT EXISTS base_room text;
UPDATE public.sessions SET base_starts_at = starts_at, base_venue_id = venue_id, base_room = room, moved_at = NULL;

CREATE OR REPLACE FUNCTION public.sessions_mark_moved()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.base_starts_at := COALESCE(NEW.base_starts_at, NEW.starts_at);
    NEW.base_venue_id := COALESCE(NEW.base_venue_id, NEW.venue_id);
    NEW.base_room := COALESCE(NEW.base_room, NEW.room);
    RETURN NEW;
  END IF;
  -- Organizer accepted the current place/time as the new baseline: keep their moved_at.
  IF NEW.base_starts_at IS DISTINCT FROM OLD.base_starts_at
     OR NEW.base_venue_id IS DISTINCT FROM OLD.base_venue_id
     OR NEW.base_room IS DISTINCT FROM OLD.base_room THEN
    RETURN NEW;
  END IF;
  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.venue_id IS DISTINCT FROM OLD.venue_id OR NEW.room IS DISTINCT FROM OLD.room THEN
    IF NEW.starts_at = NEW.base_starts_at AND NEW.venue_id IS NOT DISTINCT FROM NEW.base_venue_id AND NEW.room IS NOT DISTINCT FROM NEW.base_room THEN
      NEW.moved_at := NULL;
    ELSE
      NEW.moved_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sessions_mark_moved ON public.sessions;
CREATE TRIGGER sessions_mark_moved BEFORE INSERT OR UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.sessions_mark_moved();