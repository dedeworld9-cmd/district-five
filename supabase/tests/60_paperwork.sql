-- BCSO paperwork: office, roster, registrations, CAD, evidence, confiscation, agreement, suggestions.

select tst.become('bcso_mem');
set role authenticated;
select tst.fails($$select public.save_submission(null, 'office_request', 'bcso', '{"description":"[TEST] new radio","priority":"Whenever"}', null, null, null, null, true)$$,
                 'D5422', 'office request: priority must come from the list');
select (public.save_submission(null, 'office_request', 'bcso', '{"description":"[TEST] new radio","priority":"High"}', null, null, null, null, true)).id as ofr \gset
select tst.ok((select title from public.submissions where id = :'ofr') = 'Office request · High · [TEST] new radio', 'office request: readable title');
select (public.save_submission(null, 'roster_update', 'bcso', '{"character_name":"[TEST] Miles","update_type":"LOA","reason":"Vacation"}', null, current_date, null, null, true)).id as rup \gset
select tst.ok((select required_tier from public.submissions where id = :'rup') = 'high_command', 'roster update: routed to high command');
select tst.fails($$select public.save_submission(null, 'vehicle_reg', 'bcso', '{"dl_on_cad":"Yes","make":"Bravado","model":"Buffalo"}', null, null, null, null, true)$$,
                 'D5422', 'vehicle registration: plate is required');
select tst.fails($$select public.save_submission(null, 'firearm_reg', 'bcso', '{"fl_on_cad":"Yes","dept_certified":"Yes","make":"Vom Feuer","model":"P9","firearm_type":"Bazooka"}', null, null, null, null, true)$$,
                 'D5422', 'firearm registration: type must come from the list');
select tst.ok((public.save_submission(null, 'firearm_reg', 'bcso', '{"fl_on_cad":"Yes","dept_certified":"Yes","make":"Vom Feuer","model":"P9","firearm_type":"Handgun"}', null, null, null, null, true)).status = 'submitted', 'firearm registration: submits');
select tst.fails($$select public.save_submission(null, 'cad_report', 'bcso', '{"cad_no":"1","call_type":"10-50","location":"x","summary":"x"}', null, null, null, null, true)$$,
                 'D5422', 'cad report: date is required');
select tst.ok((public.save_submission(null, 'evidence_log', 'bcso', '{"case_no":"R-1","item":"[TEST] pistol","storage":"Locker 3"}', null, current_date, null, null, true)).status = 'submitted', 'evidence log: submits');
select tst.fails($$select public.save_submission(null, 'agreement', 'bcso', '{"character_name":"[TEST] Miles","agrees":"No","signature":"TM"}', null, null, null, null, true)$$,
                 'D5422', 'agreement: must agree');
select tst.ok((public.save_submission(null, 'suggestion', 'bcso', '{"topic":"[TEST] radios","suggestion":"More radios"}', null, null, null, null, true)).status = 'submitted', 'suggestion: submits');
select tst.fails($$select public.save_submission(null, 'arrest', 'bcso', '{"suspect_name":"x","charges":"x","bail_status":"Maybe"}', null, current_date, null, null, true)$$,
                 'D5422', 'arrest: still checked after the update');
reset role;

select tst.become('bcso_sup');
set role authenticated;
select tst.fails(format('select public.decide_submission(%L, %L)', :'rup', 'approve'), 'D5403', 'roster update: supervisor cannot decide');
select tst.ok((public.decide_submission(:'ofr', 'approve')).status = 'approved', 'office request: supervisor approves');
reset role;
