import {test,expect} from '@playwright/test';import fs from 'node:fs/promises';
test.beforeEach(async({page})=>{await page.goto('');await expect(page.locator('html')).toHaveAttribute('data-ready','true');await page.waitForFunction(()=>window.__geometryAudit&&window.__hydraulic&&!window.__hydraulic.busy);});
test('数据依据与来源对话框不把假定或缺失记录当成现场核验',async({page})=>{
 await page.locator('#geometry-data-details summary').click();await expect(page.locator('#geometry-data-content')).toContainText('419 / 420');await expect(page.locator('#geometry-readiness')).toHaveText('关键数据待补');await expect(page.locator('#geometry-data-content')).toContainText('缺少建筑记录不代表现场无建筑');
 await page.locator('#sources').click();await expect(page.locator('#dialog-geometry-audit')).toContainText('河床断面与纵剖面');await page.locator('#close-dialog').click();
});
test('原始DEM、修改分布与水动力地形切换，计算数据不被展示模式改写',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));if(!await page.evaluate(()=>window.__hydraulic.active))await page.locator('#hydraulic-enter').click();await page.locator('#river-geometry-details>summary').click();const initial=await page.evaluate(()=>window.__hydraulic.metrics.stored);
 for(const view of ['raw','difference','model']){await page.locator(`button[data-geometry-view="${view}"]`).click();await expect(page.locator('#hydraulic-canvas')).toHaveAttribute('data-geometry-view',view);expect(await page.evaluate(()=>window.__hydraulic.metrics.stored)).toBe(initial);}
 await page.locator('#geometry-row').fill('20');expect(await page.evaluate(()=>window.__geometryReview.row)).toBe(20);await expect(page.locator('#geometry-plan image')).toHaveAttribute('href',/^data:image\/png/);
 await page.locator('.hydraulic-settings summary').click();await page.locator('#hydraulic-bankDepth').fill('5');await page.locator('#hydraulic-apply').click();await page.waitForFunction(()=>!window.__hydraulic.busy&&window.__hydraulic.parameters.bankDepth===5);
 const d=page.waitForEvent('download');await page.locator('#geometry-export').click();const item=await d,payload=JSON.parse(await fs.readFile(await item.path(),'utf8'));expect(payload.parameters.bankDepth).toBe(5);expect(payload.geometryVerified).toBe(false);expect(payload.raw.length).toBe(9216);expect(payload.profile[0].raw).toBe(payload.raw[payload.profile[0].index]);expect(payload.profile[0].used).toBe(payload.used[payload.profile[0].index]);expect(errors).toEqual([]);
});
test('核查剖面和数据清单在手机可读，导出仍包含未通过的几何状态',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.locator('#geometry-data-details summary').click();await page.locator('.provenance-panel').screenshot({path:'artifacts/geometry-evidence-mobile.png'});if(!await page.evaluate(()=>window.__hydraulic.active))await page.locator('#hydraulic-enter').click();await page.locator('#river-geometry-details>summary').click();await page.locator('.geometry-review').screenshot({path:'artifacts/geometry-review-mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);const d=page.waitForEvent('download');await page.locator('#export').click();const item=await d,payload=JSON.parse(await fs.readFile(await item.path(),'utf8'));expect(payload.geometryEvidence.readiness.ready).toBe(false);expect(payload.state.geometryVerified).toBe(false);
});
