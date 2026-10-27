-- Department panels: department heads administer their own department only.

select tst.become('bcso_head');
set role authenticated;
select tst.ok(public.can_administer('bcso') and not public.can_administer('sahp'), 'head: administers own department only');
select tst.ok((public.admin_update_department('bcso', 600, null, null, null, null, null)).quota_minutes = 600, 'head: sets own quota');
select tst.fails($$select public.admin_update_department('sahp', 600, null, null, null, null, null)$$, 'D5403', 'head: cannot change another department');
select (public.admin_save_rank(null, 'bcso', '[TEST] Reserve Deputy', 'RD', 'patrol', 5, true)).id as rk \gset
select tst.ok((select department_key from public.ranks where id = :'rk') = 'bcso', 'head: adds a rank');
select tst.fails($$select public.admin_save_rank(null, 'bcso', '[TEST] Boss', null, 'dps', 500, true)$$, 'D5403', 'head: cannot create a division command rank');
select tst.fails(format('select public.admin_save_rank(%L, %L, %L, null, %L, 1, true)', (select id from public.ranks where department_key = 'sahp' limit 1), 'bcso', 'Hijack', 'patrol'),
                 'D5403', 'head: cannot edit another department''s rank by id');
select tst.fails($$select public.admin_save_route('shift_log', null, 'patrol', 'high_command')$$, 'D5403', 'head: cannot change the district default route');
select public.admin_save_route('shift_log', 'bcso', 'patrol', 'high_command');
select tst.ok((select required_tier from public.approval_routes where department_key = 'bcso' and submitter_tier = 'patrol') = 'high_command', 'head: sets own route');
select tst.ok((public.admin_save_option(null, 'bcso', 'certification', '[TEST] K9', null, 'patrol', true, 1)).department_key = 'bcso', 'head: adds a certification');
reset role;

select tst.become('bcso_hc');
set role authenticated;
select tst.ok(not public.can_administer('bcso'), 'high command: no administration panel');
select tst.fails($$select public.admin_update_department('bcso', 60, null, null, null, null, null)$$, 'D5403', 'high command: cannot change settings');
reset role;

select tst.become('bcso_sup');
set role authenticated;
select tst.fails($$select public.admin_save_option(null, 'bcso', 'certification', '[TEST] Nope', null, 'patrol', true, 1)$$, 'D5403', 'supervisor: cannot add options');
reset role;

select tst.become('dps_user');
set role authenticated;
select tst.ok(public.can_administer('bcso') and public.can_administer('sahp'), 'division command: administers its departments');
reset role;
