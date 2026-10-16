import {test,expect} from '@playwright/test';
test.setTimeout(150000);
const ready=p=>p.waitForFunction(()=>document.documentElement.dataset.ready==='true');
test('三页重排：八类过程切换、真实播放、控件唯一且无脚本错误',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('?area=overview');await ready(page);await page.waitForFunction(()=>window.__hydraulic&&!window.__hydraulic.busy);
 for(const id of ['ice','wind','heat','forest','landslide','debris','heat','landslide','lightning','water']){
  await page.locator(`[data-hazard="${id}"]`).click();
  const repeated=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i)});expect(repeated).toEqual([]);
  if(['heat','forest','landslide','debris'].includes(id)){
   await expect(page.locator('.reference-process-slot #process-primary-number')).toBeVisible();await expect(page.locator('.reference-playback #process-play')).toBeVisible();await page.locator('#process-seek').fill('2');expect(await page.evaluate(()=>window.__hazardEffects.time)).toBe(2);
  }
 }
 await page.waitForFunction(()=>window.__hydraulic.active&&!window.__hydraulic.busy);await expect(page.locator('.reference-process-slot #hydraulic-qPeak')).toBeVisible();await expect(page.locator('.reference-playback #hydraulic-play')).toBeVisible();await page.locator('#hydraulic-play').click();await page.waitForFunction(()=>window.__hydraulic.t>60);await page.locator('#hydraulic-play').click();await page.waitForFunction(()=>!window.__hydraulic.playing);expect(errors).toEqual([]);
});
test('草稿与成功记录分开，水尺与八类表单、原始上报不混淆',async({page})=>{
 await page.goto('device.html');await page.locator('#depth-number').fill('28');await page.locator('#send').click();await expect(page.locator('#station-last-receipt')).toContainText('28');await page.locator('#depth-number').fill('35');await expect(page.locator('#depth-display')).toContainText('35');await expect(page.locator('#station-last-receipt')).toContainText('28');await expect(page.locator('#station-last-receipt')).toContainText('尚未上报');await expect(page.locator('#station-history-chart circle')).toHaveCount(1);await expect(page.locator('#send-log tr')).toHaveCount(1);expect(await page.locator('#water-fill').evaluate(e=>parseFloat(e.style.height))).toBeCloseTo(35/60*100);
 for(const id of ['ice','lightning','wind','heat','forest','landslide','debris']){await page.locator(`[data-station-risk="${id}"]`).click();await expect(page.locator('#station-gauge')).toBeHidden();await expect(page.locator('#depth-number')).toBeVisible();}await page.locator('[data-station-risk="water"]').click();await expect(page.locator('#depth-number')).toHaveValue('35');await expect(page.locator('#station-last-receipt')).toContainText('28');
});
test('终端未知、提醒、已阅与展开依据保留；桌面列表占满分栏',async({context,page})=>{
 await page.setViewportSize({width:1586,height:1000});await page.goto('terminal.html');await expect(page.locator('[data-risk]')).toHaveCount(8);await expect(page.locator('#terminal-summary')).toContainText('数据未知');expect(await page.locator('.terminal-others').evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(900);
 const d=await context.newPage();await d.goto('device.html');await d.locator('[data-depth="35"]').click();await d.locator('#send').click();const w=page.locator('[data-risk="water"]');await expect(w).toContainText('高风险演示');await w.locator('[data-ack]').click();await expect(w).toContainText('已确认本次提醒');await expect(w).toContainText('高风险演示');await page.locator('[data-risk="ice"]>details>summary').click();await expect(page.locator('[data-risk="ice"] .scene-link')).toBeVisible();await expect(page.locator('[data-risk="ice"] [data-ack]')).toBeDisabled();
});
