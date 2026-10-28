-- Commendations, disciplinary write-ups and notes on a member's personnel record,
-- written by high command and up. The hub still never issues automatic strikes.

create or replace function public.add_personnel_note(
  p_membership uuid, p_category text, p_title text, p_detail text, p_effective date default null)
returns public.personnel_records language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  m public.memberships;
  r public.personnel_records;
begin
  select * into m from public.memberships where id = p_membership;
  if m.id is null then perform public.d5_raise('D5404', 'Membership not found.'); end if;
  if not public.can_manage_roster(m.department_key) then perform public.d5_raise('D5403', 'High command authority is required.'); end if;
  if m.profile_id = p.id then perform public.d5_raise('D5403', 'Another commander must write entries on your own record.'); end if;
  if not (public.oversees(m.department_key) or public.is_admin())
     and public.tier_rank(m.tier) >= public.tier_rank(public.my_tier(m.department_key)) then
    perform public.d5_raise('D5403', 'You can only write entries for members below your own tier.');
  end if;
  if p_category not in ('commendation', 'disciplinary', 'note') then perform public.d5_raise('D5422', 'Choose commendation, disciplinary or note.'); end if;
  if length(trim(coalesce(p_title, ''))) < 3 then perform public.d5_raise('D5422', 'Give the entry a short title.'); end if;
  if p_effective is not null and p_effective > current_date then perform public.d5_raise('D5422', 'The date cannot be in the future.'); end if;
  insert into public.personnel_records (membership_id, department_key, category, title, detail, effective_date, created_by, created_by_name)
  values (m.id, m.department_key, p_category, left(trim(p_title), 200), nullif(left(trim(coalesce(p_detail, '')), 4000), ''),
          coalesce(p_effective, current_date), p.id, p.display_name)
  returning * into r;
  perform public.write_audit(p, 'personnel.' || p_category, 'personnel_record', r.id, r.ref, r.department_key);
  return r;
end;
$$;

revoke execute on function public.add_personnel_note(uuid, text, text, text, date) from public, anon;
grant execute on function public.add_personnel_note(uuid, text, text, text, date) to authenticated;
