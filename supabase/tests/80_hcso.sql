-- HCSO, the department this site serves: seeded from the department's own Discord and SOP.

select tst.ok((select count(*) from public.ranks where department_key = 'hcso' and not is_sample) = 12, 'hcso: twelve confirmed ranks');
select tst.ok((select tier from public.ranks where department_key = 'hcso' and name = 'Sheriff') = 'department_head', 'hcso: sheriff heads the department');
select tst.ok((select count(*) from public.department_options where department_key = 'hcso' and kind = 'subdivision') = 2, 'hcso: patrol and TEU');
select tst.ok((select count(*) from public.policies where department_key = 'hcso' and status = 'approved') = 7, 'hcso: seven SOP policies');

select tst.become(null);
set role anon;
select tst.ok((select count(*) from public.departments where key = 'hcso') = 1, 'public: hcso is listed');
select tst.ok((select count(*) from public.department_options where department_key = 'hcso') = 2, 'public: hcso divisions are listed');
select tst.ok((select count(*) from public.policies where department_key = 'hcso') = 0, 'public: SOP summaries stay members-only');
reset role;
