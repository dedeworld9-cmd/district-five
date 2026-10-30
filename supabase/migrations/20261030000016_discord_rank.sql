-- Discord rank hint. At sign-in the app reads the member's roles in the HCSO server and stores the
-- highest rank role here. It is only a suggestion shown to command staff; nobody's tier or rank
-- changes until staff approve a request or change a rank themselves.

alter table public.profiles
  add column discord_rank text,
  add column discord_rank_at timestamptz;

create or replace function public.report_discord_rank(p_rank text)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := public.require_user();
begin
  if p_rank is not null and not exists (select 1 from public.ranks where department_key = 'hcso' and name = p_rank) then
    perform public.d5_raise('D5400', 'Unknown rank.');
  end if;
  update public.profiles set discord_rank = p_rank, discord_rank_at = now() where id = p.id;
end;
$$;

revoke all on function public.report_discord_rank(text) from public, anon;
grant execute on function public.report_discord_rank(text) to authenticated;
