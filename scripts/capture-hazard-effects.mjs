import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1536,height:1080}}),errors=[],summary=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(process.env.MONITOR_BASE_URL||'http://127.0.0.1:5173/');await page.waitForSelector('html[data-ready=true]');
  for(const id of (process.env.EFFECT_IDS?.split(',')??['ice','wind','heat','forest','landslide','debris'])){
    await page.locator(`[data-hazard="${id}"]`).click();await page.locator('[data-preset="2"]').click();
    if(id==='ice')await page.locator('[data-key="surface"]').selectOption('积雪');
    if(id==='forest')await page.locator('[data-key="inspection"]').selectOption('发现烟雾');
    if(id==='landslide')await page.locator('[data-key="inspection"]').selectOption('发现裂缝');
    await page.locator('#effect-seek').fill('15');await page.locator('#effect-focus').click();await page.locator('.map-panel').scrollIntoViewIfNeeded();
    await page.waitForFunction(id=>window.__hazardLayer?.id===id,id);await page.waitForTimeout(400);
    await page.locator('.map-panel').screenshot({path:`artifacts/effect-${id}.png`});
    if(id==='debris'){await page.waitForFunction(()=>!document.querySelector('#toast').textContent);await page.locator('.effects-panel').screenshot({path:'artifacts/effect-controls.png'});}
    summary.push(await page.evaluate(()=>({...window.__hazardLayer,drawCalls:window.__sceneMetrics.drawCalls})));
  }
  console.log(JSON.stringify({errors,summary},null,2));
}finally{await browser.close();}
