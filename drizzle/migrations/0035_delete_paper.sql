create or replace function public.delete_paper(_submission uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare touched uuid[]; code text; n_remote int := 0;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'not allowed'; end if;
  select submission_code into code from submissions where id = _submission;
  if code is null then raise exception 'paper not found'; end if;
  select coalesce(array_agg(person_id), '{}') into touched from submission_people where submission_id = _submission;
  update help_requests set detail_request_id = null
   where detail_request_id in (select id from detail_requests where submission_id = _submission);
  delete from submissions where id = _submission;
  -- Profiles created only as placeholders for this paper (no email, no sign-in, no other links, no card role) are removed.
  delete from people p where p.id = any(touched) and p.email_missing and p.user_id is null and p.card_role is null
    and not exists (select 1 from submission_people sp where sp.person_id = p.id)
    and not exists (select 1 from registrations r where r.person_id = p.id)
    and not exists (select 1 from check_ins c where c.person_id = p.id)
    and not exists (select 1 from person_connections c where c.owner_person_id = p.id or c.other_person_id = p.id);
  with u as (
    update people p set attendance_mode = 'remote', directory_opt_in = false
     where p.id = any(touched) and p.card_role is null and p.attendance_mode <> 'remote'
       and coalesce(p.category,'') not ilike 'Participant (non-presenting)%'
       and not exists (select 1 from submission_people sp join submissions x on x.id = sp.submission_id
         where sp.person_id = p.id and sp.is_presenter and x.presentation_mode = 'offline')
     returning 1)
  select count(*) into n_remote from u;
  return jsonb_build_object('code', code, 'now_remote', n_remote);
end $fn$;
revoke execute on function public.delete_paper(uuid) from public, anon;
grant execute on function public.delete_paper(uuid) to authenticated;