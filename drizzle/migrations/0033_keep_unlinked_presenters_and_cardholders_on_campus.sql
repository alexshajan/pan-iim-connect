create or replace function public.set_presenting(_submission uuid, _name text, _on boolean)
returns uuid language plpgsql security definer set search_path to 'public' as $fn$
declare
  s record; pid uuid; k text; org text; names text; keep text;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'not allowed'; end if;
  select * into s from submissions where id = _submission;
  if s.id is null then raise exception 'paper not found'; end if;
  k := regexp_replace(regexp_replace(lower(_name), '^(dr|prof|mr|ms|mrs)\.?\s+', ''), '[^a-z]', '', 'g');
  select sp.person_id into pid from submission_people sp join people p on p.id = sp.person_id
   where sp.submission_id = _submission
     and regexp_replace(regexp_replace(lower(p.full_name), '^(dr|prof|mr|ms|mrs)\.?\s+', ''), '[^a-z]', '', 'g') = k
   limit 1;
  if pid is null and _on then
    select a->>'org' into org from jsonb_array_elements(s.authors) a
     where regexp_replace(regexp_replace(lower(a->>'name'), '^(dr|prof|mr|ms|mrs)\.?\s+', ''), '[^a-z]', '', 'g') = k limit 1;
    insert into people (email, email_missing, full_name, organization, organization_raw, category, attendance_mode, directory_opt_in)
    values ('pending-' || gen_random_uuid() || '@no-email.invalid', true,
            regexp_replace(_name, '^(Dr|Prof|Mr|Ms|Mrs)\.?\s+', '', 'i'), org, org, 'Author',
            case when s.presentation_mode = 'offline' then 'on_campus' else 'remote' end, true)
    returning id into pid;
    insert into submission_people (submission_id, person_id, role, is_presenter) values (_submission, pid, 'presenter', true);
  elsif pid is not null then
    update submission_people set is_presenter = _on, role = case when _on then 'presenter' else 'author' end
     where submission_id = _submission and person_id = pid;
  end if;

  -- Keep presenters named on the paper who have no linked profile yet (unless this call turned that name off).
  select string_agg(btrim(n), ', ') into keep
    from unnest(string_to_array(coalesce(s.presenter_name, ''), ',')) n
   where btrim(n) <> ''
     and regexp_replace(regexp_replace(lower(btrim(n)), '^(dr|prof|mr|ms|mrs)\.?\s+', ''), '[^a-z]', '', 'g') <> k
     and not exists (select 1 from submission_people sp join people p on p.id = sp.person_id
                      where sp.submission_id = _submission
                        and regexp_replace(regexp_replace(lower(p.full_name), '^(dr|prof|mr|ms|mrs)\.?\s+', ''), '[^a-z]', '', 'g')
                          = regexp_replace(regexp_replace(lower(btrim(n)), '^(dr|prof|mr|ms|mrs)\.?\s+', ''), '[^a-z]', '', 'g'));
  select string_agg(p.full_name, ', ' order by p.full_name) into names
    from submission_people sp join people p on p.id = sp.person_id
   where sp.submission_id = _submission and sp.is_presenter;
  update submissions set presenter_name = nullif(concat_ws(', ', keep, names), '') where id = _submission;

  if pid is not null then
    if _on then
      update people set directory_opt_in = true,
        attendance_mode = case when s.presentation_mode = 'offline' then 'on_campus' else attendance_mode end
       where id = pid;
    else
      update people p set attendance_mode = 'remote', directory_opt_in = false
       where p.id = pid and p.card_role is null
         and coalesce(p.category, '') not ilike 'Participant (non-presenting)%'
         and not exists (select 1 from submission_people sp join submissions x on x.id = sp.submission_id
                          where sp.person_id = p.id and sp.is_presenter and x.presentation_mode = 'offline');
    end if;
  end if;
  return pid;
end $fn$;
grant execute on function public.set_presenting(uuid, text, boolean) to authenticated;

CREATE OR REPLACE FUNCTION public.refresh_attendance_modes()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.people p SET attendance_mode = CASE WHEN p.card_role IS NOT NULL OR EXISTS (
      SELECT 1 FROM public.submission_people sp JOIN public.submissions s ON s.id = sp.submission_id
      WHERE sp.person_id = p.id AND s.presentation_mode = 'offline') THEN 'on_campus' ELSE 'remote' END
  WHERE EXISTS (SELECT 1 FROM public.submission_people sp WHERE sp.person_id = p.id);
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_attendance_modes() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_presentation_mode(_submission uuid, _mode text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organizer(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _mode NOT IN ('offline','online') THEN RAISE EXCEPTION 'bad mode'; END IF;
  UPDATE public.submissions SET presentation_mode = _mode, mode_status = 'confirmed' WHERE id = _submission;
  UPDATE public.people p SET attendance_mode = CASE WHEN p.card_role IS NOT NULL OR EXISTS (
      SELECT 1 FROM public.submission_people sp JOIN public.submissions s ON s.id = sp.submission_id
      WHERE sp.person_id = p.id AND s.presentation_mode = 'offline') THEN 'on_campus' ELSE 'remote' END
  WHERE p.id IN (SELECT person_id FROM public.submission_people WHERE submission_id = _submission);
END $$;
GRANT EXECUTE ON FUNCTION public.set_presentation_mode(uuid, text) TO authenticated;