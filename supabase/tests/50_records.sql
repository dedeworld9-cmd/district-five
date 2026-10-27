-- Arrest reports, citations and OIS reports. Runs after 40_submissions.sql.

select tst.become('sahp_mem');
set role authenticated;
select tst.fails($$select public.save_submission(null, 'arrest', 'sahp', '{"suspect_name":"[TEST] Miles"}', null, current_date, null, null, true)$$,
                 'D5422', 'arrest: charges and bail status are required');
select tst.fails($$select public.save_submission(null, 'arrest', 'sahp', '{"suspect_name":"[TEST] Miles","charges":"x","bail_status":"Maybe"}', null, current_date, null, null, true)$$,
                 'D5422', 'arrest: bail status must come from the list');
select tst.fails($$select public.save_submission(null, 'arrest', 'sahp', '{"suspect_name":"[TEST] Miles","charges":"x","bail_status":"Paid"}', null, null, null, null, true)$$,
                 'D5422', 'arrest: date is required');
select (public.save_submission(null, 'arrest', 'sahp',
        '{"suspect_name":"[TEST] Miles","charges":"Evading","bail_status":"Paid","bail":"25,000"}', null, current_date, null, null, true)).id as arr \gset
select tst.ok((select title from public.submissions where id = :'arr') = 'Arrest · [TEST] Miles', 'arrest: readable title');
select tst.ok((select required_tier from public.submissions where id = :'arr') = 'supervisor', 'arrest: routed to supervisors');

select tst.fails($$select public.save_submission(null, 'citation', 'sahp', '{"suspect_name":"[TEST] Connor","violation":"Speeding","fine":"$500","fine_status":"Later"}', null, current_date, null, null, true)$$,
                 'D5422', 'citation: status must be paid or unpaid');
select (public.save_submission(null, 'citation', 'sahp',
        '{"suspect_name":"[TEST] Connor","violation":"Speeding","fine":"$500","fine_status":"Unpaid"}', null, current_date, null, null, true)).id as cit \gset
select tst.ok((select title from public.submissions where id = :'cit') = 'Citation · [TEST] Connor · Speeding', 'citation: readable title');

select tst.fails($$select public.save_submission(null, 'ois', 'sahp', '{"location":"Route 68","suspect_status":"Injured","scene":"x"}', null, current_date, null, null, true)$$,
                 'D5422', 'ois: video evidence required');
select (public.save_submission(null, 'ois', 'sahp', '{"location":"Route 68","suspect_status":"Injured","scene":"[TEST] suspect fired first"}',
        'https://example.test/ois', current_date, null, null, true)).id as ois \gset
select tst.ok((select required_tier from public.submissions where id = :'ois') = 'department_head', 'ois: routed to department heads');
-- older kinds still go through the original checks
select tst.fails($$select public.save_submission(null, 'incident', 'sahp', '{"location":"Route 68"}', null, current_date, null, null, true)$$,
                 'D5422', 'incident: still checked after the update');
reset role;

select tst.become('safd_ff');
set role authenticated;
select tst.fails($$select public.save_submission(null, 'arrest', 'safd', '{"suspect_name":"x","charges":"x","bail_status":"Paid"}', null, current_date, null, null, true)$$,
                 'D5422', 'arrest: Fire/EMS does not file arrests');
reset role;

select tst.become('sahp_sup');
set role authenticated;
select tst.fails(format('select public.decide_submission(%L, %L)', :'ois', 'approve'), 'D5403', 'ois: supervisor cannot decide');
select tst.ok((public.decide_submission(:'arr', 'approve')).status = 'approved', 'arrest: supervisor approves');
reset role;
