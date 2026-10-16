import {test,expect} from '@playwright/test';
test.setTimeout(120000);
test('监测盒、监测页与终端同源联动；确认不解除；断连未知',async({context,page})=>{
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
 await page.goto('?street=1');await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 const device=await context.newPage();await device.goto('device.html');const terminal=await context.newPage();await terminal.goto('terminal.html');
 await device.locator('[data-depth="35"]').click();await device.locator('#send').click();await expect(page.locator('#value-number')).toHaveValue('35');
 const water=terminal.locator('.risk-card').filter({has:terminal.getByRole('heading',{name:'积水',exact:true})});await expect(water).toContainText('高风险演示');await water.getByRole('button',{name:'确认已阅'}).click();await expect(water).toContainText('已确认本次提醒');await expect(page.locator('#events')).toContainText('警示终端：积水已阅');await expect(water).toContainText('高风险演示');
 await device.locator('#quality').selectOption('missing');await device.locator('#send').click();await expect(water).toContainText('数据异常');await expect(water).toContainText('末次等级：高风险演示');await expect(page.locator('#status')).toContainText('未知');
 await terminal.locator('#receive').click();await expect(water).toContainText('接收已断开');await terminal.locator('#receive').click();await expect(water).toContainText('数据异常');
 await device.locator('#quality').selectOption('valid');await device.locator('[data-depth="8"]').click();await device.locator('#send').click();await expect(water).toContainText('常态演示');
 await expect(page.locator('#status')).toContainText('未知',{timeout:18000});await page.close();await expect(water).toContainText('上报超时',{timeout:18000});expect(errors).toEqual([]);
});
test('设备页面手机排版、定时上报和独立入口',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('device.html');await page.locator('#auto').click();await expect(page.locator('#send-result')).toContainText('第2条',{timeout:8000});await page.locator('#auto').click();await page.screenshot({path:'artifacts/device-mobile.png',fullPage:true});for(const path of ['device.html','terminal.html']){await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('nav a[aria-current]')).toHaveCount(1)}await page.screenshot({path:'artifacts/terminal-mobile.png',fullPage:true});});
