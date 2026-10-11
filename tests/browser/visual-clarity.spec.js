import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('');await page.evaluate(()=>localStorage.clear());await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');});
test('手机画面内没有说明面板遮挡，工具栏和图例位于模型下方',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const id of ['ice','wind','heat','forest','landslide','debris']){
  await page.locator(`[data-hazard="${id}"]`).click();await page.locator('#effect-focus').click();
  const boxes=await page.evaluate(()=>{const rect=s=>{const b=document.querySelector(s).getBoundingClientRect();return {top:b.top,bottom:b.bottom};};return {canvas:rect('#canvas'),toolbar:rect('.map-toolbar'),caption:rect('#scene-caption'),label:rect('.effect-map-label'),details:document.querySelector('.map-context').open};});
  expect(boxes.toolbar.top).toBeGreaterThanOrEqual(boxes.canvas.bottom);expect(boxes.caption.top).toBeGreaterThanOrEqual(boxes.canvas.bottom);expect(boxes.details).toBe(false);expect(boxes.label.bottom-boxes.canvas.top).toBeLessThan(180);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test('云间通道横向可辨，单次形态自动取景且通道完整在画面内',async({page})=>{
 await page.locator('[data-hazard="lightning"]').click();await page.locator('#lightning-dynamic').uncheck();await page.locator('#lightning-type').selectOption('云间');await page.locator('#lightning-apply').click();await page.locator('#lightning-single').click();
 const cloud=await page.evaluate(()=>window.__lightningFraming);expect(cloud.type).toBe('云间');expect(cloud.inFrame).toBe(true);expect(cloud.spanX).toBeGreaterThan(cloud.spanY);
 await page.locator('#lightning-type').selectOption('云对地');await page.locator('#lightning-apply').click();await page.locator('#lightning-single').click();expect(await page.evaluate(()=>window.__lightningFraming.inFrame)).toBe(true);
});
test('高分屏画布保持像素密度，场景标注互不重叠',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),page=await context.newPage();await page.goto(process.env.MONITOR_BASE_URL||'http://127.0.0.1:5173/');await expect(page.locator('html')).toHaveAttribute('data-ready','true');
 const canvas=await page.evaluate(()=>{const c=document.querySelector('#canvas>canvas');return {width:c.width,css:c.clientWidth};});expect(canvas.width/canvas.css).toBeGreaterThanOrEqual(1.99);
 const boxes=await page.evaluate(()=>[...document.querySelectorAll('.map-label')].filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom};}));
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];expect(a.r<=b.l||b.r<=a.l||a.b<=b.t||b.b<=a.t).toBe(true);}await context.close();
});
test('WebGL不可用仍显示公开高程底图，风险选择和参数可用',async({browser})=>{
 const context=await browser.newContext(),page=await context.newPage();await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:original.call(this,type,...args);};});
 await page.goto(process.env.MONITOR_BASE_URL||'http://127.0.0.1:5173/');await expect(page.locator('html')).toHaveAttribute('data-ready','true');await expect(page.locator('.fallback-map image')).toHaveAttribute('href',/^data:image\/png/);await expect(page.locator('.fallback-map')).toContainText('三维渲染不可用');await page.locator('[data-hazard="heat"]').click();await page.locator('#value-number').fill('39');await page.locator('#value-number').press('Tab');await expect(page.locator('#metric-value')).toContainText('39');await page.locator('.map-panel').screenshot({path:'artifacts/map-fallback.png'});await context.close();
});
test('陡坡滑移模型按三维高度差取景，手机与桌面均不裁切土体',async({page})=>{
 for(const viewport of [{width:1536,height:1080},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.locator('[data-hazard="landslide"]').click();await page.locator('#effect-travel').fill('30');await page.locator('#effect-travel').press('Tab');await page.locator('#effect-seek').fill('20');await page.locator('#effect-focus').click();
  await page.waitForFunction(()=>window.__hazardLayer.id==='landslide'&&window.__hazardLayer.soilVisible&&window.__hazardLayer.soilInFrame);expect(await page.evaluate(()=>window.__hazardLayer.soilInFrame)).toBe(true);
 }
});
