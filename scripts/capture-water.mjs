import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=metal']});const page=await browser.newPage({viewport:{width:1536,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto(process.env.MONITOR_BASE_URL||'http://127.0.0.1:5173');await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForSelector('html[data-ready=true]');
for(const depth of [0,5,15,30,60]){await page.locator(`[data-water-sample="${depth}"]`).click();await page.locator('.water-panel').screenshot({path:`artifacts/water-${depth}.png`});}
await page.locator('#water-animation').uncheck();console.log(JSON.stringify({view:await page.evaluate(()=>window.__waterView),errors}));await browser.close();
