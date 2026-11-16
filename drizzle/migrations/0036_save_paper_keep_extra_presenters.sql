create or replace function public.save_paper_authors(_submission uuid, _title text, _track text, _authors jsonb, _extra jsonb)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare
  s record; a jsonb; i int := 0; pid uuid; nm text; og text; pres boolean;
  keep uuid[] := '{}'; touched uuid[]; names text[] := '{}'; xn text;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'not allowed'; end if;
  select * into s from submissions where id = _submission;
  if s.id is null then raise exception 'paper not found'; end if;
  select coalesce(array_agg(person_id), '{}') into touched from submission_people where submission_id = _submission;

  for a in select * from jsonb_array_elements(coalesce(_authors,'[]'::jsonb)) loop
    i := i + 1;
    nm := btrim(coalesce(a->>'name',''));
    if nm = '' then continue; end if;
    og := nullif(btrim(coalesce(a->>'org','')), '');
    pres := coalesce((a->>'presenting')::boolean, false);
    pid := nullif(a->>'person_id','')::uuid;
    if pid is null then
      select sp.person_id into pid from submission_people sp join people p on p.id = sp.person_id
       where sp.submission_id = _submission and public.norm_person_name(p.full_name) = public.norm_person_name(nm) limit 1;
    end if;
    if pid is null and pres then
      insert into people (email, email_missing, full_name, organization, organization_raw, category, attendance_mode, directory_opt_in)
      values ('pending-' || gen_random_uuid() || '@no-email.invalid', true,
              regexp_replace(nm, '^(Dr|Prof|Mr|Ms|Mrs)\.?\s+', '', 'i'), og, og, 'Author', 'remote', true)
      returning id into pid;
    end if;
    if pid is not null then
      if exists (select 1 from submission_people where submission_id = _submission and person_id = pid) then
        update submission_people set is_presenter = pres, role = case when pres then 'presenter' else 'author' end, author_order = i, affiliation = og
         where submission_id = _submission and person_id = pid;
      else
        insert into submission_people (submission_id, person_id, role, is_presenter, author_order, affiliation)
        values (_submission, pid, case when pres then 'presenter' else 'author' end, pres, i, og);
      end if;
      keep := keep || pid;
    end if;
    if pres then names := names || nm; end if;
  end loop;

  -- Linked people not on the byline keep their presenter status AND their name in the programme.
  for a in select * from jsonb_array_elements(coalesce(_extra,'[]'::jsonb)) loop
    pid := (a->>'person_id')::uuid;
    if pid = any(keep) then continue; end if;
    pres := coalesce((a->>'presenting')::boolean,false);
    update submission_people set is_presenter = pres, role = case when pres then 'presenter' else role end, author_order = null
     where submission_id = _submission and person_id = pid;
    if pres then
      select full_name into xn from people where id = pid;
      if xn is not null and not exists (select 1 from unnest(names) n where public.norm_person_name(n) = public.norm_person_name(xn)) then
        names := names || xn;
      end if;
    end if;
    keep := keep || pid;
  end loop;

  delete from submission_people where submission_id = _submission and not (person_id = any(keep));

  update submissions set
    title = coalesce(nullif(btrim(_title),''), title),
    track = nullif(btrim(coalesce(_track,'')),''),
    authors = (select coalesce(jsonb_agg(jsonb_build_object('name', btrim(x->>'name'), 'org', nullif(btrim(coalesce(x->>'org','')),'')) order by o), '[]'::jsonb)
                 from jsonb_array_elements(coalesce(_authors,'[]'::jsonb)) with ordinality t(x,o) where btrim(coalesce(x->>'name','')) <> ''),
    presenter_name = nullif(array_to_string(names, ', '), '')
  where id = _submission;

  touched := touched || keep;
  update people p set directory_opt_in = true, attendance_mode = 'on_campus'
   where p.id = any(touched) and exists (select 1 from submission_people sp join submissions x on x.id = sp.submission_id
     where sp.person_id = p.id and sp.is_presenter and x.presentation_mode = 'offline');
  update people p set attendance_mode = 'remote', directory_opt_in = false
   where p.id = any(touched) and p.card_role is null
     and coalesce(p.category,'') not ilike 'Participant (non-presenting)%'
     and not exists (select 1 from submission_people sp join submissions x on x.id = sp.submission_id
       where sp.person_id = p.id and sp.is_presenter and x.presentation_mode = 'offline');
end $fn$;
grant execute on function public.save_paper_authors(uuid, text, text, jsonb, jsonb) to authenticated;