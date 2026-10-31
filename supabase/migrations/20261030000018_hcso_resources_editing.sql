-- HCSO High Ranking can add and edit everything in Resources (the policy library). Before, only a
-- department head or division command could. Other departments are unchanged. The site admin may
-- also edit HCSO resources, so the person who maintains the site is not locked out.

create or replace function public.save_policy(
  p_id uuid, p_title text, p_category text, p_department text, p_version text, p_summary text,
  p_body text, p_source_url text, p_requires_ack boolean, p_effective date, p_approve boolean)
returns public.policies language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
  pol public.policies;
begin
  if p_id is not null then
    select * into pol from public.policies where id = p_id for update;
    if pol.id is null then perform public.d5_raise('D5404', 'Policy not found.'); end if;
    p_department := pol.department_key;
  end if;
  if p_department is null and not public.is_dps() then perform public.d5_raise('D5403', 'District policies are managed by division command.'); end if;
  if p_department is not null and not (public.has_tier(p_department, 'department_head') or public.oversees(p_department)
      or (p_department = 'hcso' and (public.has_tier(p_department, 'high_command') or public.is_admin()))) then
    perform public.d5_raise('D5403', 'High command or a department head manages department policies.');
  end if;
  if p_id is null then
    insert into public.policies (title, category, department_key, version, summary, body, source_url, requires_acknowledgment, effective_date, status, approved_by, approved_at)
    values (p_title, coalesce(p_category, 'sop'), p_department, coalesce(p_version, '1.0'), p_summary, p_body, p_source_url, coalesce(p_requires_ack, false), p_effective,
            case when p_approve then 'approved' else 'draft' end, case when p_approve then p.id end, case when p_approve then now() end)
    returning * into pol;
  else
    update public.policies set title = p_title, category = coalesce(p_category, category), version = coalesce(p_version, version),
      summary = p_summary, body = p_body, source_url = p_source_url, requires_acknowledgment = coalesce(p_requires_ack, requires_acknowledgment),
      effective_date = p_effective, status = case when p_approve then 'approved' else status end,
      approved_by = case when p_approve then p.id else approved_by end, approved_at = case when p_approve then now() else approved_at end
    where id = pol.id returning * into pol;
  end if;
  perform public.write_audit(p, 'policy.saved', 'policy', pol.id, pol.ref, pol.department_key);
  return pol;
end;
$$;