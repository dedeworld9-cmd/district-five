const { chromium } = require('playwright');
const out = process.argv[2]; const widths = (process.argv[3]||'1440,390').split(',').map(Number);
const handle = process.argv[4] || 'hcso_head';
const paths = ['/hub','/hub/department','/hub/patrol','/hub/logging','/hub/shifts/new','/hub/training','/hub/high-ranking','/hub/high-ranking/tools','/hub/department/mass-shifts','/hub/patrol/chat','/hub/logging/results','/hub/training/bls-exam'];
(async () => {
  const b = await chromium.launch();
  for (const w of widths) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://localhost:3000/dev-login');
    await pg.click(`form:has(input[value="${handle}"]) button`);
    await pg.waitForURL(/\/hub/);
    for (const p of paths) {
      const r = await pg.goto('http://localhost:3000'+p, { waitUntil: 'networkidle' });
      await pg.addStyleTag({content:'nextjs-portal,a[href="/dev-login"]{display:none!important}'});
      const o = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await pg.screenshot({ path: `${out}/${handle}${p.replace(/\//g,'_')}-${w}.png`, fullPage: true });
      console.log(w, p, r.status(), 'overflow', o>0?o:'no', errs.length?errs:'');
    }
    await ctx.close();
  }
  await b.close();
})();
