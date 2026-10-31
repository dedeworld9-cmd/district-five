const { chromium } = require('playwright');
const { execSync } = require('child_process');
const B = 'http://localhost:3000';
const q = (sql) => execSync(`psql -At -U root -h /var/run/postgresql d5dev -c "${sql}"`).toString().trim();
const res = [];
const t = (n, ok, x = '') => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(B + '/dev-login');
  await pg.click('form:has(input[value="hcso_member"]) button');
  await pg.waitForURL(/\/hub/);
  const count = () => +q("select count(*) from submissions");
  const base = count();
  await pg.goto(B + '/hub/reports/new?kind=incident');
  const texts = pg.locator('form textarea, form input[name^="f_"]');
  t('incident form renders fields', (await texts.count()) > 2, String(await texts.count()));
  // 1: empty submit
  await pg.locator('button[name=intent][value=submit], button:has-text("Submit")').first().click();
  await pg.waitForTimeout(1200);
  const body1 = await pg.evaluate(() => document.body.innerText);
  t('empty submit creates nothing', count() === base, `count ${count()}`);
  t('empty submit shows a message, not a crash', !/Application error|Internal Server/.test(body1));
  // 2: extremely long input
  await pg.goto(B + '/hub/reports/new?kind=incident');
  const big = 'A'.repeat(60000);
  const ta = pg.locator('form textarea').first();
  await ta.evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, big);
  const inputs = pg.locator('form input[name^="f_"]:not([type=checkbox])');
  for (let i = 0; i < Math.min(await inputs.count(), 6); i++) {
    const el = inputs.nth(i);
    const type = await el.getAttribute('type');
    if (!type || type === 'text') await el.fill('x');
  }
  await pg.locator('button:has-text("Save draft"), button[value=draft]').first().click().catch(() => {});
  await pg.waitForTimeout(1500);
  const body2 = await pg.evaluate(() => document.body.innerText);
  t('60k-character field is rejected or capped cleanly, no raw error', !/Application error|Internal Server|violates|SQLSTATE|stack/i.test(body2), body2.slice(0, 120).replace(/\n/g, ' '));
  t('no oversized record stored', +q("select count(*) from submissions where length(details::text) > 20000") === 0);
  // 3: double click save
  await pg.goto(B + '/hub/reports/new?kind=incident');
  const before = count();
  const fields = pg.locator('form textarea, form input[name^="f_"]:not([type=checkbox]):not([type=date]):not([type=datetime-local])');
  for (let i = 0; i < await fields.count(); i++) await fields.nth(i).fill('audit text').catch(() => {});
  const btn = pg.locator('button:has-text("Save draft"), button[value=draft]').first();
  await Promise.all([btn.click({ clickCount: 3, delay: 10 }).catch(() => {}), pg.waitForTimeout(2500)]);
  await pg.waitForTimeout(1500);
  const added = count() - before;
  t('triple click saves at most one record', added <= 1, `added ${added}`);
  t('no page errors', errs.length === 0, errs[0] || '');
  await b.close();
  console.log(res.every(Boolean) ? 'ALL PASS' : 'SOME FAIL');
})();
