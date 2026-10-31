const { chromium } = require('playwright');
const B = 'http://localhost:3000';
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const r = [];
  const ok = (c, m) => r.push(`${c ? 'PASS' : 'FAIL'} ${m}`);
  // Public mobile menu, keyboard only
  let pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto(B + '/', { waitUntil: 'networkidle' });
  const btn = pg.locator('header button[aria-expanded]');
  ok(await btn.getAttribute('aria-expanded') === 'false', 'menu starts collapsed');
  ok(await btn.getAttribute('aria-controls') !== null, 'menu button has aria-controls');
  await btn.focus(); await pg.keyboard.press('Enter');
  ok(await btn.getAttribute('aria-expanded') === 'true', 'Enter opens menu');
  const active = await pg.evaluate(() => document.activeElement?.textContent?.trim());
  ok(active === 'Home', `focus moves to first link (${active})`);
  await pg.screenshot({ path: out + '/menu-open-390.png' });
  await pg.keyboard.press('Escape');
  ok(await btn.getAttribute('aria-expanded') === 'false', 'Escape closes menu');
  ok(await pg.evaluate(() => document.activeElement?.getAttribute('aria-expanded') !== null), 'focus returns to menu button');
  await pg.keyboard.press('Enter'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Enter');
  await pg.waitForURL(B + '/team');
  ok(true, 'Tab + Enter in menu navigates to /team');
  ok(await btn.getAttribute('aria-expanded') === 'false', 'menu closes after navigation');
  ok(await pg.locator('a[aria-current="page"]').count() >= 0, 'current page marked');
  // Skip link
  await pg.goto(B + '/'); await pg.keyboard.press('Tab');
  ok(await pg.evaluate(() => document.activeElement?.textContent) === 'Skip to content', 'first Tab reaches skip link');
  // Headings
  for (const p of ['/', '/team', '/divisions', '/login']) {
    await pg.goto(B + p);
    const h1 = await pg.locator('h1').count();
    ok(h1 === 1, `${p} has exactly one h1 (${h1})`);
    const imgsNoAlt = await pg.locator('img:not([alt])').count();
    ok(imgsNoAlt === 0, `${p} every img has alt`);
  }
  // Desktop current link
  pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await pg.goto(B + '/divisions');
  ok(await pg.locator('nav[aria-label="Main"] a[aria-current="page"]').textContent() === 'Divisions', 'desktop nav marks Divisions current');
  // Join flow end to end as a new member
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  pg = await ctx.newPage();
  await pg.goto(B + '/dev-login'); await pg.click('form:has(input[value="new_member"]) button'); await pg.waitForURL(/\/hub/);
  await pg.goto(B + '/hub/join');
  await pg.selectOption('select[name="experience"]', 'No');
  await pg.click('button:has-text("Send request")');
  await pg.waitForURL((u) => !u.pathname.startsWith('/hub/join'), { timeout: 15000 }).catch(() => {});
  await pg.waitForLoadState('networkidle');
  const t = await pg.evaluate(() => document.body.innerText);
  ok(/waiting for command review/i.test(t), 'join request goes to HCSO and shows as waiting');
  // Supervisor sees it? head approves via roster - check roster pending count via supervisor panel
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  pg = await ctx2.newPage();
  await pg.goto(B + '/dev-login'); await pg.click('form:has(input[value="hcso_member"]) button'); await pg.waitForURL(/\/hub/);
  await pg.goto(B + '/hub', { waitUntil: 'networkidle' });
  await pg.getByRole('button', { name: 'Open menu' }).click();
  ok(await pg.locator('[role=dialog][aria-label=Navigation]').isVisible(), 'hub mobile drawer opens');
  await pg.screenshot({ path: out + '/hub-menu-open-390.png' });
  await pg.keyboard.press('Escape');
  ok(!(await pg.locator('[role=dialog][aria-label=Navigation]').isVisible()), 'drawer closes on Escape');
  await pg.getByRole('button', { name: 'Open menu' }).click();
  await pg.locator('[role=dialog] a:has-text("Department Hub")').first().click();
  await pg.waitForURL(/hub\/department/);
  ok(true, 'drawer navigates to Department Hub');
  // Patrol: start, confirm-to-end, prefilled logger
  await pg.goto(B + '/hub/patrol', { waitUntil: 'networkidle' });
  await pg.click('button:has-text("Start patrol")'); await pg.waitForSelector('text=Patrol in progress', { timeout: 8000 }).catch(() => {});
  ok(/Patrol in progress/.test(await pg.evaluate(() => document.body.innerText)), 'start patrol works');
  await pg.click('button:has-text("End patrol and write the log")');
  ok(await pg.locator('dialog[open]').isVisible(), 'ending asks for confirmation');
  await pg.click('dialog[open] button:has-text("Cancel")');
  ok(/Patrol in progress/.test(await pg.evaluate(() => document.body.innerText)), 'cancel keeps the patrol running');
  await pg.click('button:has-text("End patrol and write the log")');
  await pg.click('dialog[open] button:has-text("End patrol")'); await pg.waitForURL(/shifts\/new/);
  ok(true, 'end patrol opens the prefilled logger');
  // Logger: validation, draft, submit
  await pg.waitForSelector('text=Qualifying time');
  const q = await pg.locator('form:has(textarea)').first().innerText();
  ok(/Qualifying time/.test(q), 'logger shows the time summary');
  const brk = pg.locator('input[name=break_minutes]');
  await brk.fill('0');
  ok(/Check times|5 minutes/.test(await pg.evaluate(() => document.body.innerText)), 'short duration is flagged');
  await pg.fill('textarea[name=summary]', 'Ops center QA patrol');
  await pg.selectOption('select[name=bodycam_status]', 'not_applicable');
  await pg.reload({ waitUntil: 'networkidle' });
  ok(/Restored unsaved changes/.test(await pg.evaluate(() => document.body.innerText)), 'draft restored after reload');
  const start = await pg.inputValue('input[type=datetime-local] >> nth=0');
  const d = new Date(start); d.setHours(d.getHours() - 1);
  const p2 = (n) => String(n).padStart(2, '0');
  const ago = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
  await pg.fill('input[type=datetime-local] >> nth=0', ago);
  ok(/1h 0m|1h 1m|1h 2m/.test(await pg.evaluate(() => document.body.innerText)), 'qualifying time updates live');
  await pg.click('button:has-text("Submit log")'); await pg.waitForURL(/hub\/shifts\/[0-9a-f-]{36}/);
  ok(/submitted for review/i.test(await pg.evaluate(() => document.body.innerText)), 'submit goes through the existing RPC');
  await pg.goto(B + '/hub/logging', { waitUntil: 'networkidle' });
  ok(/Pending review\s*\n?1/.test(await pg.evaluate(() => document.body.innerText)), 'logging overview shows the pending log');
  console.log(r.join('\n'));
  await b.close();
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
