import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('');await page.evaluate(()=>localStorage.clear());await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');});
test('积水近景与主输入双向联动，零水深和数据异常正确',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await expect(page.locator('.water-panel')).toBeVisible();await expect(page.locator('#water-canvas canvas')).toBeVisible();
  let last=0;for(const depth of [0,5,15,30,60]){
    await page.locator(`[data-water-sample="${depth}"]`).click();await expect(page.locator('#value-number')).toHaveValue(String(depth));
    const view=await page.evaluate(()=>window.__waterView);expect(view.depth).toBe(depth);expect(view.area).toBeGreaterThanOrEqual(last);expect(view.waterVisible).toBe(depth>0);last=view.area;
  }
  await page.locator('#value-number').fill('16');await page.locator('#value-number').dispatchEvent('change');await expect(page.locator('#water-reading')).toHaveText('16 cm');
  await page.locator('#fault').click();await expect(page.locator('#water-validity')).toContainText('数据未知');await expect(page.locator('#water-reading')).toHaveText('16 cm');await expect(page.locator('#water-depth')).toBeDisabled();
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');await expect(page.locator('#water-reading')).toHaveText('16 cm');await expect(page.locator('#water-validity')).toContainText('数据未知');
  await page.locator('#fault').click();await page.locator('#water-animation').uncheck();const before=await page.evaluate(()=>window.__waterView.phase);await page.waitForTimeout(250);expect(await page.evaluate(()=>window.__waterView.phase)).toBe(before);
  await page.locator('[data-hazard="ice"]').click();await expect(page.locator('.water-panel')).toBeHidden();expect(errors).toEqual([]);
});
test('模拟降雨开关控制涟漪，手机近景没有水平溢出',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const s=window.__monitor.state;s.weather['河谷居民区'].enabled=true;s.weather['河谷居民区'].rain=40;window.__monitor.updateValue('water',30)});
  expect(await page.evaluate(()=>window.__waterView.rainActive)).toBe(true);await page.locator('#water-rain').uncheck();expect(await page.evaluate(()=>window.__waterView.rainActive)).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.locator('.water-panel').screenshot({path:'artifacts/water-mobile.png'});
});
test('退水情景与近景联动，暂停保持水深，回放终点无水',async({page})=>{
  await page.locator('[data-water-sample="30"]').click();await page.locator('.track-panel summary').click();await page.locator('#track-enabled').check();await page.locator('#track-target').fill('0');await page.locator('#track-target').press('Tab');await page.locator('#duration').fill('1');await page.locator('#duration').press('Tab');await page.locator('#prepare').click();await page.locator('#seek').fill('30');
  await expect(page.locator('#water-reading')).toHaveText('15 cm');await expect(page.locator('#water-trend')).toContainText('回落');await page.locator('#play').click();await expect(page.locator('#elapsed')).not.toHaveText('00:30');await page.locator('#play').click();const depth=await page.evaluate(()=>window.__waterView.depth);await page.waitForTimeout(1200);expect(await page.evaluate(()=>window.__waterView.depth)).toBe(depth);
  await page.locator('#seek').fill('60');await expect(page.locator('#water-reading')).toHaveText('0 cm');expect(await page.evaluate(()=>window.__waterView.waterVisible)).toBe(false);
});
