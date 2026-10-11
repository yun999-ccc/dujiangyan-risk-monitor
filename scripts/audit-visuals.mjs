import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const folder=process.env.AUDIT_DIR??'artifacts/visual-audit';await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=metal']});
const records=[],errors=[];
try{
 for(const device of ['desktop','mobile']){
  const page=await browser.newPage({viewport:device==='desktop'?{width:1536,height:1080}:{width:390,height:844},deviceScaleFactor:device==='desktop'?1:2});
  page.on('pageerror',e=>errors.push({device,error:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({device,error:m.text()});});
  await page.goto(process.env.MONITOR_BASE_URL||'http://127.0.0.1:5173/');await page.waitForSelector('html[data-ready=true]');await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForSelector('html[data-ready=true]');
  const shot=async(name,selector='.map-panel')=>{await page.locator(selector).scrollIntoViewIfNeeded();await page.waitForTimeout(250);await page.locator(selector).screenshot({path:`${folder}/${device}-${name}.png`});records.push(await page.evaluate(({device,name,selector})=>{const box=document.querySelector(selector).getBoundingClientRect();return {device,name,width:box.width,height:box.height,canvases:[...document.querySelectorAll(selector+' canvas')].map(c=>({cssWidth:c.clientWidth,cssHeight:c.clientHeight,width:c.width,height:c.height})),overflow:document.documentElement.scrollWidth>innerWidth,layer:window.__hazardLayer,lightning:window.__lightningLayer,metrics:window.__sceneMetrics};},{device,name,selector}));};
  await shot('overview');await page.locator('[data-region="city"]').click();await shot('buildings');
  for(const id of ['ice','wind','heat','forest','landslide','debris']){
   await page.locator(`[data-hazard="${id}"]`).click();await page.locator('[data-preset="2"]').click();
   if(id==='ice')await page.locator('[data-key="surface"]').selectOption('积雪');if(id==='forest')await page.locator('[data-key="inspection"]').selectOption('发现烟雾');if(id==='landslide')await page.locator('[data-key="inspection"]').selectOption('发现裂缝');
   await page.locator('#effect-seek').fill('15');await page.locator('#effect-focus').click();await shot(id);
  }
  await page.locator('[data-hazard="lightning"]').click();await page.locator('#lightning-dynamic').uncheck();await page.locator('#lightning-single').click();await page.locator('#lightning-focus').click();await shot('lightning-ground');
  await page.locator('#lightning-type').selectOption('云间');await page.locator('#lightning-apply').click();await page.locator('#lightning-single').click();await shot('lightning-cloud');
  await page.locator('[data-hazard="water"]').click();await page.locator('[data-water-sample="5"]').click();await shot('water-shallow','.water-stage');await page.locator('[data-water-sample="60"]').click();await shot('water-deep','.water-stage');
  await page.locator('#hydraulic-enter').click();await page.locator('[data-hydraulic-stage="900"]').click();await page.waitForFunction(()=>window.__hydraulic?.t===900&&!window.__hydraulic.busy);await shot('river');
  await page.close();
 }
 await writeFile(`${folder}/report.json`,JSON.stringify({errors,records},null,2));console.log(JSON.stringify({errors,views:records.length,overflow:records.filter(r=>r.overflow)},null,2));
}finally{await browser.close();}
