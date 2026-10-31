// Visits every route as several personas at six widths. Records console/CSP errors, failed requests,
// horizontal overflow, missing h1, unlabeled buttons/inputs, and saves screenshots for review.
const { chromium } = require('playwright');
const fs = require('fs');
const B = 'http://localhost:3000';
const OUT = '/tmp/claude-0/qa/audit';
fs.mkdirSync(OUT, { recursive: true });
const widths = [1920, 1440, 1024, 768, 390, 375];
const pub = ['/', '/team', '/divisions', '/login'];
const hub = ['/hub', '/hub/department', '/hub/patrol', '/hub/logging', '/hub/training', '/hub/high-ranking', '/hub/high-ranking/tools',
  '/hub/shifts', '/hub/shifts/new', '/hub/reports', '/hub/reports/new', '/hub/records', '/hub/roster', '/hub/approvals', '/hub/announcements',
  '/hub/notifications', '/hub/profile', '/hub/board', '/hub/resources', '/hub/command', '/hub/command/staff', '/hub/admin', '/hub/oversight', '/hub/join'];
const personas = ['hcso_member', 'hcso_supervisor', 'hcso_head', 'admin', 'new_member'];
const issues = [];
const note = (k, v) => { issues.push(`${k}: ${v}`); };

async function check(pg, label, w, shot) {
  const r = await pg.evaluate(() => {
    const de = document.documentElement;
    const over = de.scrollWidth - de.clientWidth;
    const h1 = document.querySelectorAll('h1').length;
    const unl = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea')].filter((e) => {
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false;
      const name = (e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || '').trim();
      const lab = e.labels && e.labels.length;
      return !name && !lab && !e.getAttribute('placeholder') && !e.getAttribute('aria-labelledby') && !e.querySelector('img[alt],svg title');
    }).length;
    const small = [...document.querySelectorAll('button,a[href]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.height < 24 || r.width < 24) && !e.closest('p,li > span'); }).length;
    return { over, h1, unl, small, text: document.body.innerText.slice(0, 200) };
  });
  if (r.over > 1) note('OVERFLOW', `${label} @${w} +${r.over}px`);
  if (r.h1 !== 1) note('H1', `${label} @${w} count=${r.h1}`);
  if (r.unl) note('UNLABELED', `${label} @${w} ${r.unl} controls`);
  if (/Application error|Internal Server Error|Unhandled/.test(r.text)) note('ERRORPAGE', `${label} @${w}`);
  if (shot) await pg.screenshot({ path: `${OUT}/${label.replace(/[^a-z0-9]+/gi, '_')}_${w}.png`, fullPage: false });
}

(async () => {
  const b = await chromium.launch();
  const sum = [];
  for (const who of ['anon', ...personas]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const pg = await ctx.newPage();
    pg.on('console', (m) => { if (m.type() === 'error') note('CONSOLE', `${who} ${pg.url().replace(B, '')} ${m.text().slice(0, 160)}`); });
    pg.on('pageerror', (e) => note('PAGEERROR', `${who} ${pg.url().replace(B, '')} ${String(e).slice(0, 160)}`));
    pg.on('requestfailed', (r) => { if (!/_next\/static|\.mp4/.test(r.url())) note('REQFAIL', `${who} ${r.url().slice(0, 100)} ${r.failure()?.errorText}`); });
    pg.on('response', (r) => { if (r.status() >= 500) note('HTTP5xx', `${who} ${r.url().replace(B, '')} ${r.status()}`); });
    if (who !== 'anon') {
      await pg.goto(B + '/dev-login');
      await pg.click(`form:has(input[value="${who}"]) button`);
      await pg.waitForURL(/\/hub/);
    }
    const routes = who === 'anon' ? pub : [...(who === 'hcso_member' ? pub : []), ...hub];
    for (const rt of routes) {
      for (const w of widths) {
        await pg.setViewportSize({ width: w, height: w <= 768 ? 844 : 900 });
        const resp = await pg.goto(B + rt, { waitUntil: 'networkidle' });
        const shot = (who === 'hcso_head' || who === 'anon' || (who === 'hcso_member' && rt === '/hub')) && [1440, 768, 390].includes(w);
        await check(pg, `${who}${rt}`, w, shot);
        if (w === 1440) sum.push(`${who.padEnd(15)} ${rt.padEnd(26)} ${resp.status()} -> ${pg.url().replace(B, '')}`);
      }
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(`${OUT}/routes.txt`, sum.join('\n'));
  const uniq = [...new Set(issues)];
  fs.writeFileSync(`${OUT}/issues.txt`, uniq.join('\n'));
  console.log('routes visited', sum.length, 'issues', uniq.length);
  const by = {};
  uniq.forEach((i) => { const k = i.split(':')[0]; by[k] = (by[k] || 0) + 1; });
  console.log(by);
})();
