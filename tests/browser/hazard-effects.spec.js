import {test,expect} from '@playwright/test';
test.setTimeout(90000);
test.beforeEach(async({page})=>{await page.goto('');await page.evaluate(()=>localStorage.clear());await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true',{timeout:30000});});
const select=async(page,id)=>{await page.locator(`[data-hazard="${id}"]`).click();await expect(page.locator('#effect-title')).not.toBeEmpty();await page.waitForFunction(id=>window.__hazardLayer?.id===id&&window.__hazardLayer.visible,id);};
test('六类沙盘效果可见、参数改变且无运行错误',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  for(const id of ['ice','wind','heat','forest','landslide','debris']){await select(page,id);await expect(page.locator('.effects-panel')).toBeVisible();await expect(page.locator('#effect-readings')).not.toBeEmpty();await expect(page.locator('.effect-map-label')).toContainText(/假定|示意|核查/);}
  await select(page,'wind');await page.locator('#wind-speed-number').fill('30');await page.locator('#wind-speed-number').press('Tab');await page.locator('#wind-direction-number').fill('90');await page.locator('#wind-direction-number').press('Tab');await page.locator('#effect-seek').fill('10');await page.waitForFunction(()=>window.__hazardLayer.strength>.8&&window.__hazardLayer.direction===90);expect(errors).toEqual([]);
});
test('冰雪与林火证据门控，降低数值不会清除巡查记录',async({page})=>{
  await select(page,'ice');await page.locator('#value-number').fill('-8');await page.locator('#value-number').press('Tab');await page.locator('[data-key="surface"]').selectOption('有水');expect(await page.evaluate(()=>window.__hazardEffects.ice)).toBe(false);
  await page.locator('#effect-formation').check();await page.waitForFunction(()=>window.__hazardLayer.ice);await page.locator('#effect-formation').uncheck();await page.locator('[data-key="inspection"]').selectOption('发现结冰');await page.waitForFunction(()=>window.__hazardLayer.ice);
  await select(page,'forest');await page.locator('#value-number').fill('100');await page.locator('#value-number').press('Tab');expect(await page.evaluate(()=>window.__hazardEffects.smoke)).toBe(false);await page.locator('[data-key="inspection"]').selectOption('发现烟雾');await page.waitForFunction(()=>window.__hazardLayer.smoke);await page.locator('#value-number').fill('0');await page.locator('#value-number').press('Tab');await page.waitForFunction(()=>window.__hazardLayer.smoke);
});
test('运动明确启动、暂停和未知冻结，回放不改变监测读数',async({page})=>{
  await select(page,'debris');await page.locator('[data-preset="2"]').click();expect(await page.evaluate(()=>window.__hazardEffects.activated)).toBe(false);await page.waitForFunction(()=>!window.__hazardLayer.mudVisible);
  await page.locator('#effect-play').click();await page.waitForFunction(()=>window.__hazardEffects.time>.5);await page.locator('#effect-play').click();const time=await page.evaluate(()=>window.__hazardEffects.time);await page.waitForTimeout(250);expect(await page.evaluate(()=>window.__hazardEffects.time)).toBe(time);
  await page.locator('#effect-seek').fill('15');await page.waitForFunction(()=>window.__hazardLayer.time===15&&window.__hazardLayer.mudVisible&&window.__hazardLayer.frontMeters>0);const before=await page.evaluate(()=>window.__hazardLayer.frontMeters);
  await page.locator('#quality').selectOption('missing');await expect(page.locator('#effect-validity')).toContainText('冻结最后有效');await expect(page.locator('#effect-play')).toBeDisabled();await page.waitForTimeout(300);expect(await page.evaluate(()=>window.__hazardLayer.frontMeters)).toBe(before);
  await page.locator('#quality').selectOption('valid');await page.locator('#effect-rewind').click();expect(await page.evaluate(()=>window.__monitor.state.states.debris.value)).toBe(60);await page.waitForFunction(()=>!window.__hazardLayer.mudVisible);
});
test('滑移演示与位移监测分开；静态阶段和配置刷新保留',async({page})=>{
  await select(page,'landslide');await page.locator('#effect-travel').fill('30');await page.locator('#effect-travel').press('Tab');await page.locator('#effect-seek').fill('10');await page.waitForFunction(()=>window.__hazardLayer.soilVisible);await expect(page.locator('#effect-readings')).toContainText('15.0 / 30 m');await page.locator('#effect-motion').uncheck();expect(await page.evaluate(()=>window.__monitor.state.states.landslide.value)).toBe(.4);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true',{timeout:30000});await expect(page.locator('#effect-motion')).not.toBeChecked();await expect(page.locator('#effect-travel')).toHaveValue('30');expect(await page.evaluate(()=>window.__hazardEffects.running)).toBe(false);
});
test('手机无溢出，减少动态效果默认关闭且可定位静态阶段',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true',{timeout:30000});await select(page,'heat');await expect(page.locator('#effect-motion')).not.toBeChecked();await expect(page.locator('#effect-play')).toBeDisabled();await page.locator('#effect-seek').fill('10');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'artifacts/effects-mobile.png',fullPage:true});
});
test('旧数据无有效快照时不伪造现象，效果到终点自动暂停',async({page})=>{
  await page.evaluate(()=>{window.__monitor.state.states.forest.quality='missing';window.__monitor.select('forest');});
  await expect(page.locator('#effect-readings')).toContainText('暂无有效环境输入');await page.waitForFunction(()=>window.__hazardLayer.id==='forest'&&!window.__hazardLayer.visible);
  await select(page,'landslide');await page.locator('#effect-duration').fill('5');await page.locator('#effect-duration').press('Tab');await page.locator('#effect-speed').selectOption('5');await page.locator('#effect-play').click();await page.waitForFunction(()=>window.__hazardEffects.time===5&&!window.__hazardEffects.running);await expect(page.locator('#effect-time')).toHaveText('5.0 / 5 s');
});
