const { chromium } = require('playwright'); const fs=require('fs');
const out=process.argv[2]; fs.mkdirSync(out,{recursive:true});
const shots=[['hcso_member',[['department','/hub/department'],['patrol','/hub/patrol'],['logging','/hub/logging'],['activity-logger','/hub/shifts/new'],['training','/hub/training'],['gateway-patrol-chat','/hub/patrol/chat']]],['hcso_head',[['high-ranking','/hub/high-ranking'],['high-command-tools','/hub/high-ranking/tools'],['overview','/hub']]]];
(async()=>{const b=await chromium.launch();
 for (const [w,h] of [['desktop',1440],['mobile',390]]) for (const [who,list] of shots){
  const ctx=await b.newContext({viewport:{width:h,height:w==='desktop'?900:844}}); const pg=await ctx.newPage();
  await pg.goto('http://localhost:3000/dev-login'); await pg.click(`form:has(input[value="${who}"]) button`); await pg.waitForURL(/\/hub/);
  for (const [n,p] of list){ await pg.goto('http://localhost:3000'+p,{waitUntil:'networkidle'});
   await pg.addStyleTag({content:'nextjs-portal,a[href="/dev-login"]{display:none!important}'});
   await pg.screenshot({path:`${out}/${n}-${w}.png`,fullPage:w==='mobile'}); }
  await ctx.close();}
 await b.close();})();
