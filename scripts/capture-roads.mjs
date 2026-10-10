import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1536,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.MONITOR_BASE_URL||'http://127.0.0.1:5173');await page.waitForSelector('html[data-ready=true]');
for(const region of ['mountain','city']){await page.locator(`[data-region=${region}]`).click();const f=await page.evaluate(()=>window.__sceneMetrics.frames);await page.waitForFunction(f=>window.__sceneMetrics.frames>f+5,f);await page.locator('.map-panel').screenshot({path:`artifacts/roads-${region}.png`});}
console.log(JSON.stringify(await page.evaluate(()=>({roads:window.__mapData.roadCount,mountain:window.__mapData.roadMeta.filter(r=>r.mountain).length,metrics:window.__sceneMetrics})),null,2));console.log({errors});await browser.close();
