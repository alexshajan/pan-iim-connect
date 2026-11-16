CREATE OR REPLACE FUNCTION public.detail_request_ticket()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _msg text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _msg := CASE NEW.kind
      WHEN 'confirm' THEN 'Confirmed my card and paper details are correct.'
      WHEN 'presenter' THEN 'Card details: I''m the presenter (' || coalesce(NEW.proposed_name,'') || ').'
      WHEN 'name' THEN 'Card details: print my name as ' || coalesce(NEW.proposed_name,'') || '.'
      WHEN 'affiliation' THEN 'Card details: update my affiliation to ' || coalesce(NEW.proposed_org,'') || '.'
      ELSE 'Card details: add ' || coalesce(NEW.proposed_email,'') || ' as a second sign-in email.' END;
    INSERT INTO help_requests(user_id, category, message, status, resolved_at, resolution_note, detail_request_id, urgent)
    VALUES (NEW.user_id, 'registration', _msg,
      CASE WHEN NEW.kind = 'confirm' THEN 'resolved' ELSE 'open' END,
      CASE WHEN NEW.kind = 'confirm' THEN now() END,
      CASE WHEN NEW.kind = 'confirm' THEN 'Thanks for checking. Nothing to change.' END, NEW.id, false);
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected','withdrawn') THEN
    UPDATE help_requests SET status = 'resolved', resolved_at = now(),
      resolution_note = CASE NEW.status WHEN 'approved' THEN coalesce(NEW.decision_note, 'Approved. Your card is updated.')
        WHEN 'rejected' THEN coalesce(NEW.decision_note, 'We couldn''t make this change. See Card details on Home.')
        ELSE 'You withdrew this request.' END
    WHERE detail_request_id = NEW.id;
  END IF;
  RETURN NEW;
END $function$;