const { chromium } = require('playwright');
const B='http://localhost:3000';
const cmd=['1563753564512329737','1563753564684157044','1563753564864516158','1563753564684157045','1563753564684157040'];
(async()=>{
  const b=await chromium.launch();
  for (const h of ['hcso_member','hcso_supervisor','hcso_head','new_member']) {
    const ctx=await b.newContext(); const pg=await ctx.newPage();
    await pg.goto(B+'/dev-login'); await pg.click(`form:has(input[value="${h}"]) button`); await pg.waitForURL(/\/hub/);
    for (const p of ['/hub','/hub/high-ranking','/hub/high-ranking/tools','/hub/high-ranking/command-chat','/hub/high-ranking/supervisor-chat','/hub/patrol','/hub/logging','/hub/department','/hub/training']) {
      const r=await pg.goto(B+p,{waitUntil:'networkidle'});
      const html=await pg.content(); const text=await pg.evaluate(()=>document.body.innerText);
      const leaked=cmd.filter(i=>html.includes(i));
      console.log(h.padEnd(15),p.padEnd(34),r.status(),pg.url().replace(B,'').padEnd(14),/Restricted\n/.test(text)&&!/Restricted access/.test(text)?'DENIED':'ok    ', 'leaks:',leaked.length?leaked.map(x=>x.slice(-4)):'-');
    }
    await ctx.close();
  }
  await b.close();
})();
